import { jsonError, noStoreJson } from "./http.ts";
import { authenticateRequest } from "./auth.ts";

type DocumentInput = { kind?: unknown; name?: unknown; dataUrl?: unknown };

type CareTaskType = "medication" | "test" | "visit";
export type Locale = "zh" | "nan" | "hak";

const taskTypes = new Set<CareTaskType>(["medication", "test", "visit"]);

export const responseCopy = {
  zh: {
    languageInstruction: "summary、medicationNote、tasks 的 title 與 detail、warnings 全部使用臺灣華語繁體中文，不可混入台語或客語。",
    noDocuments: "請先上傳至少一張看診資料照片。",
    notConfigured: "人工智能整理服務尚未完成設定，請稍後再試。",
    unavailable: "目前無法整理照片，請稍後再試。",
    invalid: "照片整理結果格式不完整，請重新嘗試。",
    noMedication: "照片中沒有清楚的用藥資訊。",
    unclearWarning: "照片不清楚，請核對原單據。",
  },
  nan: {
    languageInstruction: "summary、medicationNote、tasks 的 title 與 detail、warnings 全部使用臺灣台語漢字，採教育部臺灣台語常用詞的自然講法，不可混入華語或客語。",
    noDocuments: "請先傳至少一張看病資料的相片。",
    notConfigured: "人工智能整理服務猶未設定好，請等一下閣試。",
    unavailable: "這馬無法度整理相片，請等一下閣試。",
    invalid: "相片整理的結果無完整，請重新試一擺。",
    noMedication: "相片內底無清楚的食藥資料。",
    unclearWarning: "相片看袂清楚，請對原本的單據。",
  },
  hak: {
    languageInstruction: "summary、medicationNote、tasks 的 title 與 detail、warnings 全部使用臺灣四縣腔客語漢字的自然講法，不可混入華語或台語。",
    noDocuments: "請先傳至少一張看症資料个相片。",
    notConfigured: "人工智能整理服務還吂設定好，請等一下再試。",
    unavailable: "這下無法度整理相片，請等一下再試。",
    invalid: "相片整理个結果毋完整，請重新試一擺。",
    noMedication: "相片肚無清楚个食藥資料。",
    unclearWarning: "相片看毋清楚，請對原來个單仔。",
  },
} as const;

export const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "medicationNote", "tasks", "warnings"],
  properties: {
    summary: { type: "string" },
    medicationNote: { type: "string" },
    tasks: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "date", "type"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          date: { type: ["string", "null"] },
          type: { type: "string", enum: ["medication", "test", "visit"] },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const block of content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        return (block as { text: string }).text;
      }
    }
  }
  return "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeAnalysisResult(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const summary = cleanText(result.summary, 1200);
  const medicationNote = cleanText(result.medicationNote, 800);
  if (!summary || !medicationNote || !Array.isArray(result.tasks) || !Array.isArray(result.warnings)) return null;

  const tasks = result.tasks.slice(0, 8).flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const task = value as Record<string, unknown>;
    const title = cleanText(task.title, 160);
    const detail = cleanText(task.detail, 500);
    const type = typeof task.type === "string" && taskTypes.has(task.type as CareTaskType)
      ? task.type as CareTaskType
      : null;
    if (!title || !detail || !type) return [];
    const rawDate = cleanText(task.date, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
    return [{ id: `document-task-${index + 1}`, title, detail, ...(date ? { date } : {}), type }];
  });

  const warnings = result.warnings
    .slice(0, 8)
    .map((warning) => cleanText(warning, 400))
    .filter(Boolean);

  return { summary, medicationNote, tasks, warnings };
}

export async function analyzeCareDocuments(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if ("response" in authentication) return authentication.response;

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const locale: Locale = input.locale === "nan" || input.locale === "hak" ? input.locale : "zh";
  const localized = responseCopy[locale];

  const questions = Array.isArray(input.questions)
    ? input.questions.filter((value): value is string => typeof value === "string").slice(0, 20).map((value) => value.slice(0, 300))
    : [];
  const documents = Array.isArray(input.documents)
    ? (input.documents as DocumentInput[]).slice(0, 6).filter((document) =>
        typeof document.dataUrl === "string" && document.dataUrl.startsWith("data:image/") && document.dataUrl.length < 9_000_000,
      )
    : [];

  if (documents.length === 0) return jsonError("NO_DOCUMENTS", localized.noDocuments, 400);

  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna";
  if (!apiKey) return jsonError("AI_NOT_CONFIGURED", localized.notConfigured, 503);

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        "你是陪診資料整理助手。請辨識使用者提供的藥袋、預約單或衛教單，只做忠實整理與提醒，絕不診斷疾病、推測病情、建議改藥或補充原文件沒有的醫療指示。",
        `輸出語言：${localized.languageInstruction}`,
        "核心任務：把照片中每一項明確、可執行的服藥、停藥、檢查、抽血、回診、預約、飲食、活動或照護指示整理成 tasks，供網站顯示在『後續待辦』下方。不得加入照片中沒有的待辦。",
        `重要規則：看不清楚的內容要放入 warnings 並使用『${localized.unclearWarning}』；日期使用 YYYY-MM-DD；沒有明確日期時 date 必須是 null；不得把使用者看診前的問題誤當成醫囑。`,
        "title 要是簡短行動句；detail 要保留原文件中的時間、頻率、地點、攜帶物品或注意事項。相同事項只保留一筆。",
        `看診前問題：${questions.length ? questions.join("；") : "無"}`,
        `如果照片中沒有明確用藥資訊，medicationNote 請寫『${localized.noMedication}』。如果沒有可辨識的待辦，tasks 回傳空陣列。`,
      ].join("\n"),
    },
    ...documents.flatMap((document) => [
      { type: "input_text", text: `文件類型：${String(document.kind || "未分類")}；檔名：${String(document.name || "未命名")}` },
      { type: "input_image", image_url: document.dataUrl, detail: "high" },
    ]),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "care_document_tasks",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });
    if (!response.ok) return jsonError("AI_UNAVAILABLE", localized.unavailable, 502);
    const payload = (await response.json()) as Record<string, unknown>;
    const parsed = normalizeAnalysisResult(JSON.parse(extractOutputText(payload)));
    if (!parsed) return jsonError("INVALID_AI_RESULT", localized.invalid, 502);
    return noStoreJson(parsed);
  } catch {
    return jsonError("AI_UNAVAILABLE", localized.unavailable, 502);
  }
}
