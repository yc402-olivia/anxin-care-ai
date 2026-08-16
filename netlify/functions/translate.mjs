export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  const { mode, text, language } = await request.json();
  const prompt = mode === "task"
    ? `Translate this Traditional Chinese caregiving instruction into ${language}. Break it into 2-5 short, actionable steps in the same language. Preserve medical measurements exactly. Return JSON with keys translation and tasks (array). Instruction: ${text}`
    : `Translate this caregiver report from ${language} into natural Traditional Chinese for a Taiwanese family. Summarize completed care, measurements, and concerns. Return JSON with keys translation (literal Traditional Chinese translation) and chineseSummary. Report: ${text}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt, text: { format: { type: "json_object" } } }),
  });
  if (!response.ok) return Response.json({ error: "Translation service unavailable" }, { status: 502 });
  const data = await response.json();
  return Response.json(JSON.parse(data.output_text));
};

export const config = { path: "/.netlify/functions/translate" };
