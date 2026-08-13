import { jsonError, noStoreJson } from "./http.ts";
import { authenticateRequest } from "./auth.ts";

type DocumentInput = { kind?: unknown; name?: unknown; dataUrl?: unknown };

const demoResult = {
  summary: "醫師交代按藥袋指示服藥，並在回診前完成抽血檢查。若出現不舒服，請依院所說明聯絡醫療人員。",
  medicationNote: "依藥袋標示的次數與時間服用，不自行增減藥量。",
  tasks: [
    { id: "medication", title: "按藥袋指示服藥", detail: "早晚飯後服用；若有不適，依醫療院所指示聯繫", type: "medication" },
    { id: "blood-test", title: "8 月 26 日前完成抽血", detail: "依檢驗單說明準備，記得攜帶健保卡", date: "2026-08-26", type: "test" },
    { id: "follow-up", title: "8 月 30 日回診", detail: "帶本次藥袋、檢驗結果與想問醫生的問題", date: "2026-08-30", type: "visit" },
  ],
  warnings: ["內容只供整理與提醒，請以醫療院所正式說明為準。"],
};

function extractOutputText(payload: Record<string, unknown>) {
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

export async function analyzeCareDocuments(request: Request): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if ("response" in authentication) return authentication.response;

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const questions = Array.isArray(input.questions)
    ? input.questions.filter((value): value is string => typeof value === "string").slice(0, 20).map((value) => value.slice(0, 300))
    : [];
  const documents = Array.isArray(input.documents)
    ? (input.documents as DocumentInput[]).slice(0, 6).filter((document) =>
        typeof document.dataUrl === "string" && document.dataUrl.startsWith("data:image/") && document.dataUrl.length < 9_000_000,
      )
    : [];

  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_VISION_MODEL || "";
  if (!apiKey || !model || documents.length === 0) return noStoreJson(demoResult);

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        "你是陪診資料整理助手。請辨識使用者提供的藥袋、預約單或衛教單，只做忠實整理與提醒，絕不診斷疾病、推測病情、建議改藥或補充原文件沒有的醫療指示。",
        "重要規則：看不清楚的內容要明說『照片不清楚，請核對原單據』；日期使用 YYYY-MM-DD；沒有日期就省略 date；不得把使用者看診前的問題誤當成醫囑。",
        `看診前問題：${questions.length ? questions.join("；") : "無"}`,
        "回傳 JSON，格式固定為：{summary:string, medicationNote:string, tasks:[{id:string,title:string,detail:string,date?:string,type:'medication'|'test'|'visit'}], warnings:string[]}。tasks 最多 8 筆。",
      ].join("\n"),
    },
    ...documents.flatMap((document) => [
      { type: "input_text", text: `文件類型：${String(document.kind || "未分類")}；檔名：${String(document.name || "未命名")}` },
      { type: "input_image", image_url: document.dataUrl },
    ]),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) return jsonError("AI_UNAVAILABLE", "AI document analysis is temporarily unavailable.", 502);
    const payload = (await response.json()) as Record<string, unknown>;
    const parsed = JSON.parse(extractOutputText(payload)) as typeof demoResult;
    if (!parsed.summary || !Array.isArray(parsed.tasks)) return jsonError("INVALID_AI_RESULT", "AI returned an invalid result.", 502);
    return noStoreJson(parsed);
  } catch {
    return jsonError("AI_UNAVAILABLE", "Unable to analyze the documents.", 502);
  }
}
