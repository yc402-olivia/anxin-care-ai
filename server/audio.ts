import { authenticateRequest } from "./auth.ts";
import { jsonError, noStoreJson } from "./http.ts";
import { analysisSchema, extractOutputText, normalizeAnalysisResult, responseCopy, type Locale } from "./analyze.ts";

const MAX_AUDIO_BYTES = 5_000_000;
const supportedAudioTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a"]);

export async function analyzeCareAudio(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if ("response" in authentication) return authentication.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_FORM", "無法讀取錄音內容，請重新錄製。", 400);
  }

  const rawLocale = form.get("locale");
  const locale: Locale = rawLocale === "nan" || rawLocale === "hak" ? rawLocale : "zh";
  const localized = responseCopy[locale];
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return jsonError("INVALID_AUDIO", "錄音內容無效或超過 5 MB，請縮短後重新錄製。", 400);
  }
  const baseType = audio.type.split(";")[0];
  if (baseType && !supportedAudioTypes.has(baseType)) {
    return jsonError("UNSUPPORTED_AUDIO", "此瀏覽器的錄音格式目前不支援。", 415);
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return jsonError("AI_NOT_CONFIGURED", localized.notConfigured, 503);

  let questions: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("questions") || "[]"));
    if (Array.isArray(parsed)) questions = parsed.filter((value): value is string => typeof value === "string").slice(0, 20);
  } catch {
    questions = [];
  }

  try {
    const transcriptionForm = new FormData();
    transcriptionForm.set("file", audio, audio.name || "visit.webm");
    transcriptionForm.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe");
    transcriptionForm.set("response_format", "json");
    transcriptionForm.set("prompt", "這是臺灣醫療院所的醫病溝通錄音。請忠實轉錄醫師、病人與陪同者的對話，保留藥名、劑量、頻率、日期與檢查名稱。不要自行補充內容。");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: transcriptionForm,
    });
    if (!transcriptionResponse.ok) return jsonError("AI_UNAVAILABLE", localized.unavailable, 502);
    const transcription = await transcriptionResponse.json() as { text?: unknown };
    const transcript = typeof transcription.text === "string" ? transcription.text.trim().slice(0, 60_000) : "";
    if (!transcript) return jsonError("EMPTY_TRANSCRIPT", "錄音中沒有辨識到清楚的對話內容。", 422);

    const summaryResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        store: false,
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "你是陪診對話整理助手。只整理逐字稿中醫師明確說過的內容，不可診斷、推測、補充或改寫成新的醫療建議。",
              localized.languageInstruction,
              "請摘要醫師說明，並把服藥、停藥、檢查、回診、生活照護與注意事項整理成 tasks。日期不明時填 null。資訊不清楚或說話者無法確認時放入 warnings。",
              `病人看診前的問題（不得誤當醫囑）：${questions.length ? questions.join("；") : "無"}`,
              "以下是本次錄音的暫時逐字稿；它只供本次分析使用，不需要在輸出中重現完整逐字稿：",
              transcript,
            ].join("\n"),
          }],
        }],
        text: { format: { type: "json_schema", name: "care_audio_tasks", strict: true, schema: analysisSchema } },
      }),
    });
    if (!summaryResponse.ok) return jsonError("AI_UNAVAILABLE", localized.unavailable, 502);
    const payload = await summaryResponse.json() as Record<string, unknown>;
    const parsed = normalizeAnalysisResult(JSON.parse(extractOutputText(payload)));
    if (!parsed) return jsonError("INVALID_AI_RESULT", localized.invalid, 502);
    return noStoreJson(parsed);
  } catch {
    return jsonError("AI_UNAVAILABLE", localized.unavailable, 502);
  }
}
