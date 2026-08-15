import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the care companion product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /安心陪診 AI/);
  assert.match(html, /正在確認登入狀態/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("keeps private keys out of browser configuration", async () => {
  const [config, environment, netlify] = await Promise.all([
    readFile(new URL("../server/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
  ]);

  assert.match(config, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(config, /SUPABASE_SECRET_KEY|OPENAI_API_KEY/);
  assert.match(environment, /OPENAI_API_KEY/);
  assert.match(environment, /SUPABASE_SECRET_KEY/);
  assert.match(netlify, /Permissions-Policy = "microphone=\(self\), camera=\(self\)"/);
});

test("requires Supabase authentication for AI analysis", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../app/CareCompanion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../server/analyze.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /signInWithOtp/);
  assert.match(client, /Authorization: `Bearer \$\{authSession\.access_token\}`/);
  assert.match(server, /authenticateRequest\(request\)/);
});

test("turns uploaded care documents into structured follow-up tasks", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../app/CareCompanion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../server/analyze.ts", import.meta.url), "utf8"),
  ]);

  assert.match(server, /type: "json_schema"/);
  assert.match(server, /detail: "high"/);
  assert.match(server, /顯示在『後續待辦』下方/);
  assert.doesNotMatch(server, /demoResult/);
  assert.match(client, /setTasks\(result\.tasks/);
  assert.doesNotMatch(client, /setTasks\(initialTasks\)/);
  assert.match(client, /className="task-empty"/);
});

test("omits the trial-mode storage notice", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/CareCompanion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(client, /試用模式|安全保存|storage-status/);
  assert.doesNotMatch(styles, /storage-status/);
});

test("switches the complete preview and AI output language together", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../app/CareCompanion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../server/analyze.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /const changeLocale =/);
  assert.match(client, /setQuestions\(\[\.\.\.copy\[nextLocale\]\.initialQuestions\]\)/);
  assert.match(client, /setTasks\(createPreviewTasks\(nextLocale\)\)/);
  assert.match(client, /summaryKicker: "AI 整理的結果"/);
  assert.match(client, /summaryKicker: "AI 整理个結果"/);
  assert.match(client, /locale,\n\s+questions/);
  assert.match(server, /localized\.languageInstruction/);
  assert.match(server, /臺灣台語漢字/);
  assert.match(server, /臺灣四縣腔客語漢字/);

  const renderedInterface = client.slice(client.indexOf("const viewerName"));
  assert.doesNotMatch(renderedInterface, />重點整理好了<|>這次醫生交代<|>問題清單<|>看診摘要<|>用藥提醒<|>後續待辦</);
});
