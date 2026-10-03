import { authenticateRequest } from "./auth.ts";
import { jsonError } from "./http.ts";

type Locale = "zh" | "nan" | "hak";

const speechInstructions: Record<Locale, string> = {
  zh: "請使用自然、親切、沉穩的台灣標準華語女性聲線朗讀。咬字清楚但不要字正腔圓到像播報，語氣像真人陪診員溫柔說明。依標點自然停頓，句子之間稍作呼吸；不要加入、刪除或改寫內容。",
  nan: "請使用自然、親切的台灣女性聲線，以流利的臺灣台語朗讀。咬字清楚、語氣溫柔，依標點自然停頓，不要加入、刪除或改寫內容。",
  hak: "請使用自然、親切的台灣女性聲線，以流利的臺灣四縣腔客語朗讀。咬字清楚、語氣溫柔，依標點自然停頓，不要加入、刪除或改寫內容。",
};

export async function createCareSpeech(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if ("response" in authentication) return authentication.response;

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "無法讀取朗讀內容。", 400);
  }

  const text = typeof input.text === "string" ? input.text.trim().slice(0, 3_500) : "";
  const locale: Locale = input.locale === "nan" || input.locale === "hak" ? input.locale : "zh";
  if (!text) return jsonError("EMPTY_SPEECH", "沒有可朗讀的內容。", 400);

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return jsonError("AI_NOT_CONFIGURED", "語音服務尚未完成設定。", 503);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_SPEECH_VOICE || "marin",
        input: text,
        instructions: speechInstructions[locale],
        response_format: "mp3",
        speed: 0.96,
      }),
    });
    if (!response.ok) return jsonError("SPEECH_UNAVAILABLE", "目前無法產生語音，請稍後再試。", 502);

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("SPEECH_UNAVAILABLE", "目前無法產生語音，請稍後再試。", 502);
  }
}
