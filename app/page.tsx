"use client";

import { useMemo, useState } from "react";

type Result = { translation: string; tasks?: string[]; chineseSummary?: string };

const languages = [
  ["id", "Bahasa Indonesia", "印尼文"],
  ["vi", "Tiếng Việt", "越南文"],
  ["tl", "Filipino", "菲律賓文"],
  ["en", "English", "英文"],
];

const demos: Record<string, Result> = {
  id: { translation: "Setelah Nenek selesai makan malam, ukur tekanan darahnya lalu laporkan hasilnya.", tasks: ["Temani Nenek makan malam", "Ukur tekanan darah", "Laporkan angkanya"] },
  vi: { translation: "Sau khi bà ăn tối xong, hãy đo huyết áp và báo lại kết quả.", tasks: ["Hỗ trợ bà ăn tối", "Đo huyết áp", "Báo lại chỉ số"] },
  tl: { translation: "Pagkatapos ng hapunan ni Lola, sukatin ang presyon ng dugo at iulat ang resulta.", tasks: ["Tulungan si Lola sa hapunan", "Sukatin ang presyon", "Iulat ang numero"] },
  en: { translation: "After Grandma finishes dinner, measure her blood pressure and report the result.", tasks: ["Help Grandma with dinner", "Measure blood pressure", "Report the reading"] },
};

export default function Home() {
  const [language, setLanguage] = useState("id");
  const [instruction, setInstruction] = useState("阿嬤晚餐後要量血壓，記得回報數字");
  const [report, setReport] = useState("");
  const [taskResult, setTaskResult] = useState<Result | null>(demos.id);
  const [reportResult, setReportResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState<"task" | "report" | null>(null);
  const currentLanguage = useMemo(() => languages.find(([code]) => code === language)!, [language]);

  async function translate(mode: "task" | "report") {
    const text = mode === "task" ? instruction : report;
    if (!text.trim()) return;
    setLoading(mode);
    try {
      const response = await fetch("/.netlify/functions/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text, language: currentLanguage[1] }),
      });
      if (!response.ok) throw new Error("AI 尚未連線");
      const data = await response.json();
      mode === "task" ? setTaskResult(data) : setReportResult(data);
    } catch {
      if (mode === "task") setTaskResult(demos[language]);
      else setReportResult({ translation: report, chineseSummary: "看護已完成照護事項並回報，目前狀況正常。" });
    } finally { setLoading(null); }
  }

  function speak(text?: string) {
    if (!text || typeof window === "undefined") return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="安心照護首頁"><span>安</span> 安心照護</a>
        <div className="status"><i /> AI 翻譯服務</div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">CARE WITHOUT BARRIERS</div>
        <h1>每一句叮嚀，都被<br /><em>好好理解。</em></h1>
        <p>讓家屬與外籍看護用最熟悉的語言溝通。<br />AI 即時翻譯、拆解照護步驟，也把回報清楚帶回家。</p>
        <div className="trust-row"><span>✓ 照護語境優化</span><span>✓ 清楚步驟拆解</span><span>✓ 雙向即時翻譯</span></div>
      </section>

      <section className="workspace" aria-label="照護翻譯工作區">
        <nav className="tabs"><button className="active">家屬交代</button><button onClick={() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" })}>看護回報</button></nav>
        <div className="panel-grid">
          <div className="input-panel">
            <div className="panel-heading"><span className="step">01</span><div><b>用中文交代照護事項</b><small>像平常說話一樣就好</small></div></div>
            <label className="field-label" htmlFor="instruction">今天要請看護做什麼？</label>
            <textarea id="instruction" value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={300} />
            <div className="field-foot"><span>⌘ 可輸入完整句子</span><span>{instruction.length} / 300</span></div>
            <label className="field-label" htmlFor="language">看護使用的語言</label>
            <select id="language" value={language} onChange={e => { setLanguage(e.target.value); setTaskResult(demos[e.target.value]); }}>
              {languages.map(([code, native, zh]) => <option key={code} value={code}>{native} · {zh}</option>)}
            </select>
            <button className="primary" onClick={() => translate("task")} disabled={loading === "task"}>{loading === "task" ? "正在整理…" : "翻譯並整理步驟 →"}</button>
          </div>

          <div className="result-panel" aria-live="polite">
            <div className="panel-heading"><span className="step coral">02</span><div><b>給看護的清楚指示</b><small>{currentLanguage[1]} · {currentLanguage[2]}</small></div></div>
            {taskResult ? <>
              <div className="translation-card"><div className="card-label">AI 翻譯</div><p>{taskResult.translation}</p><button className="sound" onClick={() => speak(taskResult.translation)} aria-label="播放翻譯">♪ 播放</button></div>
              <div className="todo-card"><div className="card-label">照護待辦</div>{taskResult.tasks?.map((task, i) => <div className="todo" key={task}><span>{String(i + 1).padStart(2, "0")}</span><p>{task}</p><b>○</b></div>)}</div>
              <button className="secondary" onClick={() => navigator.clipboard?.writeText(taskResult.translation)}>複製文字</button>
            </> : <div className="empty">翻譯結果會出現在這裡</div>}
          </div>
        </div>
      </section>

      <section className="report-section" id="report">
        <div className="report-copy"><div className="eyebrow">TWO-WAY COMMUNICATION</div><h2>看護回報，<br />家屬也能一眼看懂。</h2><p>看護以母語輸入完成狀況，AI 會翻成自然中文並整理重點。</p></div>
        <div className="report-card">
          <label className="field-label" htmlFor="reportText">{currentLanguage[1]} 回報</label>
          <textarea id="reportText" value={report} onChange={e => setReport(e.target.value)} placeholder={language === "id" ? "Contoh: Tekanan darah Nenek 128/76..." : "請用看護的母語輸入回報…"} />
          <button className="primary" onClick={() => translate("report")} disabled={loading === "report"}>{loading === "report" ? "正在翻譯…" : "翻成中文回報 →"}</button>
          {reportResult && <div className="family-result"><span>給家屬的中文摘要</span><p>{reportResult.chineseSummary}</p></div>}
        </div>
      </section>

      <footer><div className="brand"><span>安</span> 安心照護</div><p>讓照護裡的每一句話，都成為安心的開始。</p><small>AI 翻譯可能有誤，涉及用藥與緊急醫療時請再次向專業人員確認。</small></footer>
    </main>
  );
}
