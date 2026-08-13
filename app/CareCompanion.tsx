"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

type Locale = "zh" | "nan" | "hak";
type DocumentKind = "藥袋" | "預約單" | "衛教單";

type UploadedDocument = {
  file: File;
  kind: DocumentKind;
  preview: string;
};

type CareTask = {
  id: string;
  title: string;
  detail: string;
  date?: string;
  type: "medication" | "test" | "visit";
  done: boolean;
};

type AnalysisResult = {
  summary: string;
  medicationNote: string;
  tasks: Array<Omit<CareTask, "done">>;
  warnings: string[];
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const copy = {
  zh: {
    language: "語言",
    large: "大字",
    navPrepare: "看診前",
    navDocuments: "看診資料",
    navTasks: "後續待辦",
    eyebrow: "陪你記得每一件重要的事",
    titleA: "醫生說的，",
    titleB: "放心交給我整理。",
    intro: "把問題、藥袋和預約單放進來，AI 會整理成家人都看得懂的重點與待辦。",
    start: "開始整理這次看診",
    listen: "聽功能介紹",
    safety: "只整理與提醒，不提供診斷或更改醫囑",
    steps: ["先記下問題", "拍下看診資料", "帶走清楚待辦"],
    prepareKicker: "01 · 看診前",
    prepareTitle: "這次想問醫生什麼？",
    prepareIntro: "想到什麼就先記下來，也可以按麥克風直接說。",
    placeholder: "例如：最近晚上常常睡不好，需要注意什麼？",
    voice: "用說的",
    listening: "正在聽…",
    add: "加入問題",
    suggestions: ["這個藥要吃多久？", "什麼情況要提早回診？", "飲食或活動要注意什麼？"],
    documentsKicker: "02 · 看診後",
    documentsTitle: "把資料拍清楚，交給 AI 整理",
    documentsIntro: "可拍藥袋、預約單或衛教單。照片只用於本次整理。",
    takePhoto: "拍照或選照片",
    uploaded: "已加入",
    analyze: "請 AI 幫我整理",
    analyzing: "正在讀取資料…",
    summaryKicker: "03 · AI 整理結果",
    summaryTitle: "這次看診，接下來要做的事",
    read: "唸給我聽",
    stopRead: "停止朗讀",
    calendar: "全部加入日曆",
    calendarOne: "加入日曆",
    share: "分享給家人",
    copied: "已複製，可貼給家人",
    familyTitle: "家人一看就懂",
    familyText: "不必轉述整段對話，只要把整理好的重點與日期分享出去。",
    ready: "資料已整理完成",
    demo: "目前是試用模式；連接 Supabase 後會安全保存",
    saved: "已同步保存這次看診紀錄",
    noSpeech: "這個瀏覽器暫不支援語音輸入，可以直接打字。",
  },
  nan: {
    language: "語言",
    large: "大字",
    navPrepare: "看醫生進前",
    navDocuments: "看病資料",
    navTasks: "後續代誌",
    eyebrow: "陪你記牢每一項重要的代誌",
    titleA: "醫生講的，",
    titleB: "放心予我整理。",
    intro: "共問題、藥袋佮預約單囥入來，AI 會整理做厝裡人攏看會明的重點佮代誌。",
    start: "開始整理這擺看病",
    listen: "聽功能介紹",
    safety: "干焦整理佮提醒，無診斷、無改醫生交代",
    steps: ["先記問題", "翕看病資料", "帶清楚代誌轉去"],
    prepareKicker: "01 · 看醫生進前",
    prepareTitle: "這擺欲問醫生啥物？",
    prepareIntro: "想著就先記落來，也會使撳麥克風直接講。",
    placeholder: "親像：這幾工暗時攏睏袂好，愛注意啥物？",
    voice: "用講的",
    listening: "咧聽…",
    add: "加問題",
    suggestions: ["這个藥愛食偌久？", "啥物情形愛較早轉去予醫生看？", "食物抑是活動愛注意啥物？"],
    documentsKicker: "02 · 看醫生了後",
    documentsTitle: "共資料翕予清楚，交予 AI 整理",
    documentsIntro: "會使翕藥袋、預約單抑是衛教單。相片干焦用佇這擺整理。",
    takePhoto: "翕相抑是揀相片",
    uploaded: "加好矣",
    analyze: "請 AI 共我整理",
    analyzing: "咧讀資料…",
    summaryKicker: "03 · AI 整理結果",
    summaryTitle: "這擺看病，紲落來愛做的代誌",
    read: "讀予我聽",
    stopRead: "莫閣讀",
    calendar: "全部加去日曆",
    calendarOne: "加去日曆",
    share: "分享予厝裡人",
    copied: "抄好矣，會使貼予厝裡人",
    familyTitle: "厝裡人一看就知",
    familyText: "免閣講一大段，共整理好的重點佮日期分享出去就好。",
    ready: "資料整理好矣",
    demo: "這馬是試用模式；接 Supabase 了後會安全保存",
    saved: "這擺看病紀錄已經保存",
    noSpeech: "這个瀏覽器猶未支援語音輸入，會使直接拍字。",
  },
  hak: {
    language: "語言",
    large: "大字",
    navPrepare: "看症前",
    navDocuments: "看症資料",
    navTasks: "過後愛做",
    eyebrow: "陪你記得逐項重要个事情",
    titleA: "醫生講个，",
    titleB: "放心分𠊎整理。",
    intro: "摎問題、藥袋同預約單放入來，AI 會整理做屋下人全看得識个重點同愛做个事。",
    start: "開始整理這擺看症",
    listen: "聽功能紹介",
    safety: "淨整理同提醒，毋診斷、毋改醫生交代",
    steps: ["先寫問題", "影看症資料", "帶等清楚事項轉屋"],
    prepareKicker: "01 · 看症前",
    prepareTitle: "這擺愛問醫生麼个？",
    prepareIntro: "想著就先寫下來，也做得撳麥克風直接講。",
    placeholder: "比論：這幾日暗晡頭睡毋落覺，愛注意麼个？",
    voice: "用講个",
    listening: "聽等…",
    add: "加入問題",
    suggestions: ["這藥愛食幾久？", "麼个情形愛較遽轉診？", "食東西抑係活動愛注意麼个？"],
    documentsKicker: "02 · 看症後",
    documentsTitle: "資料影清楚，交分 AI 整理",
    documentsIntro: "做得影藥袋、預約單抑係衛教單。相片淨用在這擺整理。",
    takePhoto: "影相抑係揀相片",
    uploaded: "加好哩",
    analyze: "請 AI 摎𠊎整理",
    analyzing: "讀等資料…",
    summaryKicker: "03 · AI 整理結果",
    summaryTitle: "這擺看症，續下來愛做个事",
    read: "讀分𠊎聽",
    stopRead: "莫再讀",
    calendar: "全部加入日曆",
    calendarOne: "加入日曆",
    share: "分享分屋下人",
    copied: "抄好哩，做得貼分屋下人",
    familyTitle: "屋下人一看就識",
    familyText: "毋使再講一大段，摎整理好个重點同日期分享出去就好。",
    ready: "資料整理好哩",
    demo: "這下係試用模式；接 Supabase 過後會安全保存",
    saved: "這擺看症紀錄已保存",
    noSpeech: "這隻瀏覽器還吂支援語音輸入，做得直接打字。",
  },
} as const;

const documentKinds: Array<{ kind: DocumentKind; mark: string; hint: string }> = [
  { kind: "藥袋", mark: "藥", hint: "用法、劑量、注意事項" },
  { kind: "預約單", mark: "約", hint: "檢查、抽血、回診日期" },
  { kind: "衛教單", mark: "讀", hint: "居家照護與注意事項" },
];

const initialTasks: CareTask[] = [
  {
    id: "medication",
    title: "按藥袋指示服藥",
    detail: "早晚飯後服用；若有不適，依醫療院所指示聯繫",
    type: "medication",
    done: false,
  },
  {
    id: "blood-test",
    title: "8 月 26 日前完成抽血",
    detail: "依檢驗單說明準備，記得攜帶健保卡",
    date: "2026-08-26",
    type: "test",
    done: false,
  },
  {
    id: "follow-up",
    title: "8 月 30 日回診",
    detail: "帶本次藥袋、檢驗結果與想問醫生的問題",
    date: "2026-08-30",
    type: "visit",
    done: false,
  },
];

const pad = (value: number) => String(value).padStart(2, "0");

function toIcsDate(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function tomorrow(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CareCompanion() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [largeText, setLargeText] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("care-text-size") === "large",
  );
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState<string[]>([
    "這個藥需要吃多久？",
    "哪些狀況需要提早回診？",
  ]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeKind, setActiveKind] = useState<DocumentKind>("藥袋");
  const [isListening, setIsListening] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [tasks, setTasks] = useState<CareTask[]>(initialTasks);
  const [summary, setSummary] = useState("醫師交代按藥袋服藥，並在回診前完成抽血檢查。若出現不舒服，請依院所說明聯絡醫療人員。");
  const [medicationNote, setMedicationNote] = useState("依藥袋標示的次數與時間服用，不自行增減藥量。");
  const [notice, setNotice] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const t = copy[locale];

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(async (config) => {
        if (!config.configured) return;
        const client = createClient(config.supabaseUrl, config.supabasePublishableKey);
        const { data } = await client.auth.getSession();
        if (!data.session) await client.auth.signInAnonymously();
        setSupabase(client);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => documents.forEach((document) => URL.revokeObjectURL(document.preview));
  }, [documents]);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const toggleLargeText = () => {
    setLargeText((current) => {
      const next = !current;
      window.localStorage.setItem("care-text-size", next ? "large" : "normal");
      return next;
    });
  };

  const addQuestion = (value = question) => {
    const clean = value.trim();
    if (!clean || questions.includes(clean)) return;
    setQuestions((current) => [...current, clean]);
    setQuestion("");
  };

  const startVoiceInput = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(t.noSpeech);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-TW";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setQuestion(event.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 0.82;
    utterance.onend = () => setIsReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const speakIntro = () => speak(`${t.titleA}${t.titleB} ${t.intro} ${t.safety}`);

  const chooseFiles = (kind: DocumentKind) => {
    setActiveKind(kind);
    fileInputRef.current?.click();
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const additions = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 6 - documents.length)
      .map((file) => ({ file, kind: activeKind, preview: URL.createObjectURL(file) }));
    setDocuments((current) => [...current, ...additions]);
  };

  const persistVisit = async (result: AnalysisResult) => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: visit, error } = await supabase
      .from("care_visits")
      .insert({
        user_id: userData.user.id,
        questions,
        summary: result.summary,
        medication_note: result.medicationNote,
        tasks: result.tasks,
      })
      .select("id")
      .single();
    if (error || !visit) return;

    await Promise.all(
      documents.map(async (document) => {
        const safeName = document.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${userData.user?.id}/${visit.id}/${crypto.randomUUID()}-${safeName}`;
        const upload = await supabase.storage.from("care-documents").upload(path, document.file, {
          contentType: document.file.type,
          upsert: false,
        });
        if (!upload.error) {
          await supabase.from("care_documents").insert({
            visit_id: visit.id,
            user_id: userData.user?.id,
            kind: document.kind,
            storage_path: path,
            original_name: document.file.name,
          });
        }
      }),
    );
    setSaved(true);
  };

  const analyze = async () => {
    setIsAnalyzing(true);
    setNotice("");
    try {
      const payload = {
        questions,
        documents: await Promise.all(
          documents.map(async (document) => ({
            kind: document.kind,
            name: document.file.name,
            dataUrl: await fileToDataUrl(document.file),
          })),
        ),
      };
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as AnalysisResult;
      if (!response.ok) throw new Error("analysis failed");
      setSummary(result.summary);
      setMedicationNote(result.medicationNote);
      setTasks(result.tasks.map((task) => ({ ...task, done: false })));
      setHasAnalyzed(true);
      await persistVisit(result);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch {
      setHasAnalyzed(true);
      setTasks(initialTasks);
      setNotice("目前先顯示示範整理結果；連接服務後即可讀取實際資料。");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadCalendar = (selectedTasks = tasks.filter((task) => task.date)) => {
    const events = selectedTasks
      .filter((task) => task.date)
      .map((task) => {
        const date = new Date(`${task.date}T00:00:00`);
        return [
          "BEGIN:VEVENT",
          `UID:${task.id}@anxin-care`,
          `DTSTAMP:${toIcsDate(new Date())}T000000Z`,
          `DTSTART;VALUE=DATE:${toIcsDate(date)}`,
          `DTEND;VALUE=DATE:${toIcsDate(tomorrow(date))}`,
          `SUMMARY:${escapeIcs(task.title)}`,
          `DESCRIPTION:${escapeIcs(task.detail)}\\n此提醒由安心陪診 AI 整理，請以醫療院所正式資料為準。`,
          "END:VEVENT",
        ].join("\r\n");
      })
      .join("\r\n");
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Anxin Care//Care Tasks//ZH-TW\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "安心陪診-後續提醒.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareSummary = async () => {
    const text = [`【安心陪診｜這次看診重點】`, summary, "", ...tasks.map((task, index) => `${index + 1}. ${task.title}｜${task.detail}`), "", "提醒：內容僅供整理，請以醫療院所正式醫囑為準。"].join("\n");
    if (navigator.share) {
      await navigator.share({ title: "這次看診重點", text }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text);
      setNotice(t.copied);
    }
  };

  return (
    <main className="site-shell" data-text-size={largeText ? "large" : "normal"}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="安心陪診首頁">
          <span className="brand-mark"><span>安</span></span>
          <span>安心陪診</span>
        </a>
        <nav aria-label="主要導覽">
          <a href="#prepare">{t.navPrepare}</a>
          <a href="#documents">{t.navDocuments}</a>
          <a href="#result">{t.navTasks}</a>
        </nav>
        <div className="accessibility-tools">
          <label className="language-select">
            <span>{t.language}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label="選擇語言">
              <option value="zh">華語</option>
              <option value="nan">台語</option>
              <option value="hak">客語</option>
            </select>
          </label>
          <button className={`size-button ${largeText ? "is-active" : ""}`} type="button" onClick={toggleLargeText} aria-pressed={largeText}>
            <span className="size-aa">A<span>A</span></span> {t.large}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</p>
          <h1>{t.titleA}<br /><em>{t.titleB}</em></h1>
          <p className="hero-intro">{t.intro}</p>
          <div className="hero-actions">
            <a className="primary-button" href="#prepare">{t.start}<span aria-hidden="true">→</span></a>
            <button className="listen-button" type="button" onClick={speakIntro}><span className="sound-bars" aria-hidden="true"><i /><i /><i /></span>{isReading ? t.stopRead : t.listen}</button>
          </div>
          <p className="safety-note"><span aria-hidden="true">✓</span>{t.safety}</p>
        </div>

        <div className="hero-visual" aria-label="安心陪診整理結果示意">
          <div className="summary-card">
            <div className="summary-card-top">
              <span className="mini-brand">安</span>
              <span><small>安心陪診 AI</small><strong>重點整理好了</strong></span>
              <span className="status-dot">完成</span>
            </div>
            <div className="doctor-note">
              <span className="doctor-avatar">醫</span>
              <div><strong>這次醫生交代</strong><p>照藥袋服藥，先完成抽血，再帶報告回診。</p></div>
            </div>
            <ol className="mini-tasks">
              <li><span>1</span><div><strong>按藥袋服藥</strong><small>每日早晚 · 飯後</small></div><b>今天</b></li>
              <li><span>2</span><div><strong>完成抽血檢查</strong><small>記得帶健保卡</small></div><b>8/26 前</b></li>
              <li><span>3</span><div><strong>回診看報告</strong><small>帶藥袋與問題清單</small></div><b>8/30</b></li>
            </ol>
            <div className="mini-actions"><span>◷ 已設提醒</span><span>＋ 加到日曆</span></div>
          </div>
        </div>
      </section>

      <section className="step-ribbon" aria-label="使用步驟">
        {t.steps.map((step, index) => <div key={step}><span>{pad(index + 1)}</span><strong>{step}</strong>{index < 2 && <i aria-hidden="true">→</i>}</div>)}
      </section>

      <section className="workflow-section prepare-section" id="prepare">
        <div className="section-heading">
          <p>{t.prepareKicker}</p>
          <h2>{t.prepareTitle}</h2>
          <span>{t.prepareIntro}</span>
        </div>
        <div className="question-workspace">
          <div className="question-entry">
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.placeholder} rows={3} />
            <div className="question-entry-actions">
              <button type="button" className={`voice-button ${isListening ? "is-listening" : ""}`} onClick={startVoiceInput}><span>●</span>{isListening ? t.listening : t.voice}</button>
              <button type="button" className="add-button" onClick={() => addQuestion()}>{t.add}<span>＋</span></button>
            </div>
          </div>
          <div className="question-list">
            <div className="list-label"><span>問題清單</span><b>{questions.length} 題</b></div>
            {questions.map((item, index) => (
              <div className="question-item" key={`${item}-${index}`}>
                <span>{index + 1}</span><p>{item}</p>
                <button type="button" aria-label={`刪除問題：${item}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="suggestion-row">
          <span>常見問題</span>
          {t.suggestions.map((item) => <button key={item} type="button" onClick={() => addQuestion(item)}>＋ {item}</button>)}
        </div>
      </section>

      <section className="workflow-section documents-section" id="documents">
        <div className="section-heading light-heading">
          <p>{t.documentsKicker}</p>
          <h2>{t.documentsTitle}</h2>
          <span>{t.documentsIntro}</span>
        </div>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" multiple onChange={(event) => addFiles(event.target.files)} />
        <div className="document-grid">
          {documentKinds.map((item) => {
            const count = documents.filter((document) => document.kind === item.kind).length;
            return (
              <button className="document-card" type="button" key={item.kind} onClick={() => chooseFiles(item.kind)}>
                <span className="document-mark">{item.mark}</span>
                <span><strong>{item.kind}</strong><small>{item.hint}</small></span>
                <b>{count > 0 ? `${count} ${t.uploaded}` : "＋"}</b>
              </button>
            );
          })}
        </div>
        {documents.length > 0 && (
          <div className="photo-strip" aria-label="已選擇的照片">
            {documents.map((document, index) => (
              <div className="photo-thumb" key={`${document.file.name}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={document.preview} alt={`${document.kind}：${document.file.name}`} />
                <span>{document.kind}</span>
                <button type="button" aria-label={`移除 ${document.file.name}`} onClick={() => setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
        )}
        <button className="analyze-button" type="button" onClick={analyze} disabled={isAnalyzing}>
          <span className="ai-spark">✦</span>
          {isAnalyzing ? t.analyzing : t.analyze}
          <span aria-hidden="true">→</span>
        </button>
        <p className="privacy-line"><span>鎖</span> 醫療資料以安全連線處理，不會公開分享</p>
      </section>

      <section className={`result-section ${hasAnalyzed ? "is-ready" : ""}`} id="result" ref={resultRef}>
        <div className="section-heading result-heading">
          <p>{t.summaryKicker}</p>
          <h2>{t.summaryTitle}</h2>
          <span>{hasAnalyzed ? t.ready : "以下是整理結果的預覽，完成上一步後會更新成你的資料。"}</span>
        </div>
        <div className="result-layout">
          <div className="result-main">
            <div className="visit-summary">
              <div className="summary-icon">摘</div>
              <div><span>看診摘要</span><p>{summary}</p></div>
              <button type="button" onClick={() => speak(`${summary} ${tasks.map((task) => task.title).join("。")}`)}>{isReading ? "■" : "▶"}<span>{isReading ? t.stopRead : t.read}</span></button>
            </div>
            <div className="medication-banner"><span>藥</span><div><strong>用藥提醒</strong><p>{medicationNote}</p></div></div>
            <div className="task-header"><strong>後續待辦</strong><span>{completedCount} / {tasks.length} 已完成</span></div>
            <div className="task-list">
              {tasks.map((task, index) => (
                <article className={`task-card ${task.done ? "is-done" : ""}`} key={task.id}>
                  <button className="task-check" type="button" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} aria-label={task.done ? `標記 ${task.title} 為未完成` : `標記 ${task.title} 為完成`}>{task.done ? "✓" : index + 1}</button>
                  <div className="task-copy"><strong>{task.title}</strong><p>{task.detail}</p></div>
                  {task.date ? <button className="calendar-one" type="button" onClick={() => downloadCalendar([task])}><span>＋</span>{t.calendarOne}</button> : <span className="today-pill">每天</span>}
                </article>
              ))}
            </div>
          </div>
          <aside className="family-card">
            <div className="family-orbit"><span>家</span><i>✓</i></div>
            <h3>{t.familyTitle}</h3>
            <p>{t.familyText}</p>
            <button type="button" onClick={() => downloadCalendar()}><span>▣</span>{t.calendar}</button>
            <button type="button" className="share-button" onClick={shareSummary}><span>↗</span>{t.share}</button>
            <div className="storage-status"><i />{saved ? t.saved : t.demo}</div>
          </aside>
        </div>
        {notice && <div className="toast" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="關閉通知">×</button></div>}
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark"><span>安</span></span><div><strong>安心陪診</strong><small>記得醫生的每一句重要交代</small></div></div>
        <p><strong>重要提醒</strong>{"　"}本服務只協助整理與提醒，不提供診斷、用藥調整或醫療決策。所有內容請以醫師、藥師與醫療院所正式說明為準。</p>
      </footer>
    </main>
  );
}
