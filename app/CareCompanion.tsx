"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
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

type AnalysisError = {
  error?: { code?: string; message?: string };
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
    brand: "安心陪診",
    homeLabel: "安心陪診首頁",
    mainNavLabel: "主要導覽",
    language: "語言",
    selectLanguageLabel: "選擇語言",
    large: "大字",
    signOut: "登出",
    localPreview: "本機預覽",
    navPrepare: "看診前",
    navVisit: "看診中",
    navDocuments: "看診資料",
    navTasks: "後續待辦",
    eyebrow: "陪你記得每一件重要的事",
    titleA: "醫生說的，",
    titleB: "放心交給我整理。",
    intro: "把問題、藥袋和預約單放進來，人工智能會整理成家人都看得懂的重點與待辦。",
    start: "開始整理這次看診",
    listen: "聽功能介紹",
    steps: ["先記下問題", "紀錄醫病溝通", "拍下看診資料", "帶走清楚待辦"],
    prepareKicker: "看診前",
    prepareTitle: "這次想問醫生什麼？",
    prepareIntro: "想到什麼就先記下來，也可以按麥克風直接說。",
    placeholder: "例如：最近晚上常常睡不好，需要注意什麼？",
    voice: "用說的",
    listening: "正在聽…",
    add: "加入問題",
    suggestions: ["這個藥要吃多久？", "什麼情況要提早回診？", "飲食或活動要注意什麼？"],
    visitKicker: "看診中",
    visitTitle: "完整記下醫師的重要交代",
    visitIntro: "取得現場同意後開始錄音，結束時會自動整理成看診摘要與後續待辦。",
    documentsKicker: "看診後",
    documentsTitle: "把資料拍清楚，交給 AI 整理",
    documentsIntro: "可拍藥袋、預約單或衛教單。照片只用於本次整理。",
    recordingTitle: "錄下醫病溝通，整理醫師叮嚀",
    recordingIntro: "整理完成後會放入看診摘要與後續待辦；錄音只暫時處理，不會保存錄音檔。",
    recordingConsent: "開始前，請先取得醫師與現場所有人的同意。確定已取得同意並開始錄音嗎？",
    startRecording: "開始錄音",
    stopRecording: "停止並整理",
    processingRecording: "正在整理醫師交代…",
    recordingFailed: "目前無法整理錄音，請稍後再試。",
    microphoneUnavailable: "這個瀏覽器暫不支援錄音功能。",
    microphoneDenied: "無法使用麥克風，請允許麥克風權限後再試。",
    recordingLimit: "錄音已達 30 分鐘，將自動停止並開始整理。",
    takePhoto: "拍照或選照片",
    uploaded: "已加入",
    analyze: "請 AI 幫我整理",
    analyzing: "正在讀取資料…",
    summaryKicker: "AI 整理結果",
    summaryTitle: "這次看診，接下來要做的事",
    read: "唸給我聽",
    stopRead: "停止朗讀",
    speechDisclosure: "朗讀聲音由 AI 產生。",
    calendar: "全部加入日曆",
    calendarOne: "加入日曆",
    share: "分享給家人",
    copied: "已複製，可貼給家人",
    familyTitle: "家人一看就懂",
    familyText: "不必轉述整段對話，只要把整理好的重點與日期分享出去。",
    ready: "資料已整理完成",
    previewIntro: "以下是整理結果的預覽，完成上一步後會更新成你的資料。",
    noTasks: "未從照片辨識到明確待辦，請確認照片清晰後重新上傳。",
    noSpeech: "這個瀏覽器暫不支援語音輸入，可以直接打字。",
    heroVisualLabel: "安心陪診整理結果示意",
    miniReady: "重點整理好了",
    complete: "完成",
    doctorOrderTitle: "這次醫生交代",
    doctorOrderText: "照藥袋服藥，先完成抽血，再帶報告回診。",
    miniTasks: [
      { title: "按藥袋服藥", detail: "每日早晚 · 飯後", due: "今天" },
      { title: "完成抽血檢查", detail: "記得帶健保卡", due: "8/26 前" },
      { title: "回診看報告", detail: "帶藥袋與問題清單", due: "8/30" },
    ],
    reminderSet: "已設提醒",
    addCalendar: "加到日曆",
    stepsLabel: "使用步驟",
    initialQuestions: ["這個藥需要吃多久？", "哪些狀況需要提早回診？"],
    questionList: "問題清單",
    questionUnit: "題",
    deleteQuestionLabel: "刪除問題",
    commonQuestions: "常見問題",
    documentKinds: {
      藥袋: { label: "藥袋", hint: "用法、劑量、注意事項" },
      預約單: { label: "預約單", hint: "檢查、抽血、回診日期" },
      衛教單: { label: "衛教單", hint: "居家照護與注意事項" },
    },
    selectedPhotosLabel: "已選擇的照片",
    removePhotoLabel: "移除照片",
    summaryMark: "摘",
    summaryLabel: "看診摘要",
    medicationMark: "藥",
    medicationLabel: "用藥提醒",
    tasksLabel: "後續待辦",
    completedLabel: "已完成",
    markDoneLabel: "標記為完成",
    markUndoneLabel: "標記為未完成",
    everyDay: "每天",
    familyMark: "家",
    closeNoticeLabel: "關閉通知",
    footerTagline: "記得醫生的每一句重要交代",
    footerNoticeTitle: "重要提醒",
    footerNoticeText: "本服務只協助整理與提醒，不提供診斷、用藥調整或醫療決策。所有內容請以醫師、藥師與醫療院所正式說明為準。",
    noDocumentsNotice: "請先上傳至少一張看診資料照片。",
    expiredNotice: "登入已過期，請重新登入後再試。",
    analyzeFailed: "目前無法整理照片，請稍後再試。",
    invalidAnalysis: "照片整理結果格式不完整，請重新嘗試。",
    calendarDescription: "此提醒由安心陪診整理，請以醫療院所正式資料為準。",
    calendarFilename: "安心陪診-後續提醒.ics",
    shareHeading: "【安心陪診｜這次看診重點】",
    shareReminder: "提醒：內容僅供整理，請以醫療院所正式醫囑為準。",
    shareTitle: "這次看診重點",
    loadingLogin: "正在確認登入狀態…",
    authEyebrow: "醫生交代，清楚記得",
    authTitle: "使用 Gmail 登入",
    authIntro: "輸入 Email，我們會寄一封安全登入連結給你。不需要另外設定密碼。",
    emailLabel: "Gmail 或 Email",
    sendingLink: "寄送中…",
    sendLink: "寄送登入連結",
    authNotConfigured: "登入服務尚未完成設定，請稍後再試。",
    authNoPassword: "不需密碼",
    authSeparateData: "個人資料分開保存",
    authAnytimeSignOut: "隨時可以登出",
    authSafety: "安心陪診只協助整理與提醒，不提供診斷或更改醫囑。",
    loginSending: "正在寄送登入連結…",
    loginFailedPrefix: "無法寄送",
    loginSent: "登入連結已寄出，請到 Gmail 信箱點擊後回到這個頁面。",
    previewSummary: "完成看診中的錄音後，醫病溝通重點會整理在這裡。",
    previewMedication: "依藥袋標示的次數與時間服用，不自行增減藥量。",
    previewTasks: [
      { id: "medication", title: "按藥袋指示服藥", detail: "早晚飯後服用；若有不適，依醫療院所指示聯繫", type: "medication" },
      { id: "blood-test", title: "8 月 26 日前完成抽血", detail: "依檢驗單說明準備，記得攜帶健保卡", date: "2026-08-26", type: "test" },
      { id: "follow-up", title: "8 月 30 日回診", detail: "帶本次藥袋、檢驗結果與想問醫生的問題", date: "2026-08-30", type: "visit" },
    ],
  },
  nan: {
    brand: "安心陪診",
    homeLabel: "安心陪診頭頁",
    mainNavLabel: "主要選單",
    language: "語言",
    selectLanguageLabel: "揀語言",
    large: "大字",
    signOut: "登出",
    localPreview: "本機預覽",
    navPrepare: "看醫生進前",
    navVisit: "看醫生當中",
    navDocuments: "看病資料",
    navTasks: "後續代誌",
    eyebrow: "陪你記牢每一項重要的代誌",
    titleA: "醫生講的，",
    titleB: "放心予我整理。",
    intro: "共問題、藥袋佮預約單囥入來，AI 會整理做厝裡人攏看會明的重點佮代誌。",
    start: "開始整理這擺看病",
    listen: "聽功能按怎用",
    steps: ["先記問題", "記錄醫病溝通", "翕看病資料", "帶清楚代誌轉去"],
    prepareKicker: "看醫生進前",
    prepareTitle: "這擺欲問醫生啥物？",
    prepareIntro: "想著就先記落來，也會使撳麥克風直接講。",
    placeholder: "親像：這幾工暗時攏睏袂好，愛注意啥物？",
    voice: "用講的",
    listening: "咧聽…",
    add: "加問題",
    suggestions: ["這个藥愛食偌久？", "啥物情形愛較早轉去予醫生看？", "食物抑是活動愛注意啥物？"],
    visitKicker: "看醫生當中",
    visitTitle: "共醫生重要的交代記予完整",
    visitIntro: "得著現場同意了後開始錄音，結束會自動整理做看病摘要佮後續代誌。",
    documentsKicker: "看醫生了後",
    documentsTitle: "共資料翕予清楚，交予 AI 整理",
    documentsIntro: "會使翕藥袋、預約單抑是衛教單。相片干焦用佇這擺整理。",
    recordingTitle: "錄落醫生講的話，整理重要交代",
    recordingIntro: "整理好會囥入看病摘要佮後續代誌；錄音干焦暫時處理，袂保存錄音檔。",
    recordingConsent: "開始進前，請先得著醫生佮現場逐家同意。敢有確定同意，欲開始錄音？",
    startRecording: "開始錄音",
    stopRecording: "停止閣整理",
    processingRecording: "咧整理醫生交代…",
    recordingFailed: "這馬無法度整理錄音，請等一下閣試。",
    microphoneUnavailable: "這个瀏覽器暫時無支援錄音。",
    microphoneDenied: "無法度使用麥克風，請允准權限了後閣試。",
    recordingLimit: "錄音已經 30 分鐘，會自動停止閣開始整理。",
    takePhoto: "翕相抑是揀相片",
    uploaded: "加好矣",
    analyze: "請 AI 共我整理",
    analyzing: "咧讀資料…",
    summaryKicker: "AI 整理的結果",
    summaryTitle: "這擺看病，紲落來愛做的代誌",
    read: "讀予我聽",
    stopRead: "莫閣讀",
    speechDisclosure: "朗讀的聲是 AI 產生的。",
    calendar: "全部加去日曆",
    calendarOne: "加去日曆",
    share: "分享予厝裡人",
    copied: "抄好矣，會使貼予厝裡人",
    familyTitle: "厝裡人一看就知",
    familyText: "免閣講一大段，共整理好的重點佮日期分享出去就好。",
    ready: "資料整理好矣",
    previewIntro: "下跤是整理結果的預覽，頂一步完成了後，就會更新做你的資料。",
    noTasks: "相片內底無清楚的後續代誌，請共相片翕予較清楚了閣試。",
    noSpeech: "這个瀏覽器猶未支援語音輸入，會使直接拍字。",
    heroVisualLabel: "安心陪診整理結果的示意",
    miniReady: "重點整理好矣",
    complete: "完成矣",
    doctorOrderTitle: "這擺醫生交代",
    doctorOrderText: "照藥袋食藥，先去抽血，閣提報告轉去予醫生看。",
    miniTasks: [
      { title: "照藥袋食藥", detail: "逐工早暗 · 食飽後", due: "今仔日" },
      { title: "去做抽血檢查", detail: "愛記得紮健保卡", due: "8/26 進前" },
      { title: "轉去看報告", detail: "紮藥袋佮問題清單", due: "8/30" },
    ],
    reminderSet: "提醒設好矣",
    addCalendar: "加去日曆",
    stepsLabel: "按怎使用",
    initialQuestions: ["這个藥愛食偌久？", "啥物情形愛較早轉去予醫生看？"],
    questionList: "問題清單",
    questionUnit: "條",
    deleteQuestionLabel: "刪掉問題",
    commonQuestions: "逐家定定問",
    documentKinds: {
      藥袋: { label: "藥袋", hint: "食法、份量、愛注意的代誌" },
      預約單: { label: "預約單", hint: "檢查、抽血、轉去看醫生的日期" },
      衛教單: { label: "衛教單", hint: "佇厝照顧佮愛注意的代誌" },
    },
    selectedPhotosLabel: "揀好的相片",
    removePhotoLabel: "提掉相片",
    summaryMark: "摘",
    summaryLabel: "看病摘要",
    medicationMark: "藥",
    medicationLabel: "食藥提醒",
    tasksLabel: "後續代誌",
    completedLabel: "做好矣",
    markDoneLabel: "標做完成",
    markUndoneLabel: "標做猶未完成",
    everyDay: "逐工",
    familyMark: "厝",
    closeNoticeLabel: "關掉通知",
    footerTagline: "記牢醫生每一句重要的交代",
    footerNoticeTitle: "重要提醒",
    footerNoticeText: "本服務干焦協助整理佮提醒，無提供診斷、改藥抑是醫療決定。所有內容請以醫生、藥師佮醫療院所正式的說明為準。",
    noDocumentsNotice: "請先傳至少一張看病資料的相片。",
    expiredNotice: "登入過期矣，請重新登入了閣試。",
    analyzeFailed: "這馬無法度整理相片，請等一下閣試。",
    invalidAnalysis: "相片整理的結果無完整，請重新試一擺。",
    calendarDescription: "這个提醒是安心陪診整理的，請以醫療院所正式的資料為準。",
    calendarFilename: "安心陪診-後續代誌.ics",
    shareHeading: "【安心陪診｜這擺看病重點】",
    shareReminder: "提醒：內容干焦是整理，請以醫療院所正式的醫囑為準。",
    shareTitle: "這擺看病重點",
    loadingLogin: "咧確認登入狀態…",
    authEyebrow: "醫生交代，清楚記牢",
    authTitle: "用 Gmail 登入",
    authIntro: "拍 Email 入來，阮會寄一封安全登入的連結予你，毋免另外設密碼。",
    emailLabel: "Gmail 抑是 Email",
    sendingLink: "咧寄…",
    sendLink: "寄登入連結",
    authNotConfigured: "登入服務猶未設定好，請等一下閣試。",
    authNoPassword: "毋免密碼",
    authSeparateData: "個人資料分開保存",
    authAnytimeSignOut: "隨時會使登出",
    authSafety: "安心陪診干焦協助整理佮提醒，無提供診斷抑是改醫囑。",
    loginSending: "咧寄登入連結…",
    loginFailedPrefix: "寄袂出去",
    loginSent: "登入連結寄出去矣，請去 Gmail 信箱撳連結了後轉來這个頁面。",
    previewSummary: "看醫生當中的錄音完成了後，醫病溝通重點會整理佇遮。",
    previewMedication: "照藥袋頂懸寫的次數佮時間食藥，毋通家己加減藥量。",
    previewTasks: [
      { id: "medication", title: "照藥袋指示食藥", detail: "早暗食飽後服用；若感覺無爽快，請照醫療院所指示聯絡", type: "medication" },
      { id: "blood-test", title: "8 月 26 進前完成抽血", detail: "照檢驗單的說明準備，愛記得紮健保卡", date: "2026-08-26", type: "test" },
      { id: "follow-up", title: "8 月 30 轉去看醫生", detail: "紮這擺的藥袋、檢驗結果佮欲問醫生的問題", date: "2026-08-30", type: "visit" },
    ],
  },
  hak: {
    brand: "安心陪診",
    homeLabel: "安心陪診頭頁",
    mainNavLabel: "主要選單",
    language: "語言",
    selectLanguageLabel: "揀語言",
    large: "大字",
    signOut: "登出",
    localPreview: "本機預覽",
    navPrepare: "看症前",
    navVisit: "看症當中",
    navDocuments: "看症資料",
    navTasks: "過後愛做",
    eyebrow: "陪你記得逐項重要个事情",
    titleA: "醫生講个，",
    titleB: "放心分𠊎整理。",
    intro: "摎問題、藥袋同預約單放入來，AI 會整理做屋下人全看得識个重點同愛做个事。",
    start: "開始整理這擺看症",
    listen: "聽功能仰般用",
    steps: ["先寫問題", "記錄醫病溝通", "影看症資料", "帶等清楚事項轉屋"],
    prepareKicker: "看症前",
    prepareTitle: "這擺愛問醫生麼个？",
    prepareIntro: "想著就先寫下來，也做得撳麥克風直接講。",
    placeholder: "比論：這幾日暗晡頭睡毋落覺，愛注意麼个？",
    voice: "用講个",
    listening: "聽等…",
    add: "加問題",
    suggestions: ["這藥愛食幾久？", "麼个情形愛較遽轉診？", "食東西抑係活動愛注意麼个？"],
    visitKicker: "看症當中",
    visitTitle: "摎醫生重要个交代記完整",
    visitIntro: "得著現場同意過後開始錄音，結束會自動整理做看症摘要摎後續事項。",
    documentsKicker: "看症後",
    documentsTitle: "資料影清楚，交分 AI 整理",
    documentsIntro: "做得影藥袋、預約單抑係衛教單。相片淨係用來整理這擺个資料。",
    recordingTitle: "錄下醫生講个話，整理重要交代",
    recordingIntro: "整理好會放入看症摘要摎後續事項；錄音淨係暫時處理，毋會保存錄音檔。",
    recordingConsent: "開始以前，請先得著醫生摎現場逐儕个同意。確定同意愛開始錄音無？",
    startRecording: "開始錄音",
    stopRecording: "停止摎整理",
    processingRecording: "在整理醫生交代…",
    recordingFailed: "這下無法度整理錄音，請等一下再試。",
    microphoneUnavailable: "這隻瀏覽器這下無支援錄音。",
    microphoneDenied: "無法度使用麥克風，請允准權限過後再試。",
    recordingLimit: "錄音既經 30 分鐘，會自動停止摎開始整理。",
    takePhoto: "影相抑係揀相片",
    uploaded: "加好哩",
    analyze: "請 AI 分𠊎整理",
    analyzing: "讀等資料…",
    summaryKicker: "AI 整理个結果",
    summaryTitle: "這擺看症，續下來愛做个事",
    read: "讀分𠊎聽",
    stopRead: "莫再讀",
    speechDisclosure: "朗讀个聲係 AI 產生个。",
    calendar: "全部加入日曆",
    calendarOne: "加入日曆",
    share: "分享分屋下人",
    copied: "抄好哩，做得貼分屋下人",
    familyTitle: "屋下人一看就識",
    familyText: "毋使再講一大段，摎整理好个重點同日期分享出去就好。",
    ready: "資料整理好哩",
    previewIntro: "下背係整理結果个預覽，做好頂一步過後，就會換做你个資料。",
    noTasks: "相片肚無看著清楚个後續事項，請摎相片影較清楚過後再試。",
    noSpeech: "這隻瀏覽器還吂支援語音輸入，做得直接打字。",
    heroVisualLabel: "安心陪診整理結果个樣仔",
    miniReady: "重點整理好哩",
    complete: "做好哩",
    doctorOrderTitle: "這擺醫生交代",
    doctorOrderText: "照藥袋食藥，先做抽血，過後帶報告轉去看症。",
    miniTasks: [
      { title: "照藥袋食藥", detail: "逐日朝晨暗晡 · 食飽後", due: "今晡日" },
      { title: "完成抽血檢查", detail: "愛記得帶健保卡", due: "8/26 以前" },
      { title: "轉去看報告", detail: "帶藥袋同問題單", due: "8/30" },
    ],
    reminderSet: "提醒設好哩",
    addCalendar: "加到日曆",
    stepsLabel: "仰般使用",
    initialQuestions: ["這藥愛食幾久？", "麼个情形愛較遽轉去看症？"],
    questionList: "問題單",
    questionUnit: "條",
    deleteQuestionLabel: "刪忒問題",
    commonQuestions: "輒常問个問題",
    documentKinds: {
      藥袋: { label: "藥袋", hint: "食法、份量、愛注意个事情" },
      預約單: { label: "預約單", hint: "檢查、抽血、轉去看症个日期" },
      衛教單: { label: "衛教單", hint: "在屋下照顧同愛注意个事情" },
    },
    selectedPhotosLabel: "揀好个相片",
    removePhotoLabel: "拿忒相片",
    summaryMark: "撮",
    summaryLabel: "看症撮要",
    medicationMark: "藥",
    medicationLabel: "食藥提醒",
    tasksLabel: "過後愛做个事",
    completedLabel: "做好哩",
    markDoneLabel: "標做做好哩",
    markUndoneLabel: "標做還吂做好",
    everyDay: "逐日",
    familyMark: "屋",
    closeNoticeLabel: "關忒通知",
    footerTagline: "記得醫生逐句重要个交代",
    footerNoticeTitle: "重要提醒",
    footerNoticeText: "本服務淨係協助整理同提醒，毋會診斷、改藥抑係做醫療決定。所有內容請以醫生、藥師同醫療院所正式个說明為準。",
    noDocumentsNotice: "請先傳至少一張看症資料个相片。",
    expiredNotice: "登入過期哩，請重新登入過後再試。",
    analyzeFailed: "這下無法度整理相片，請等一下再試。",
    invalidAnalysis: "相片整理个結果毋完整，請重新試一擺。",
    calendarDescription: "這隻提醒係安心陪診整理个，請以醫療院所正式个資料為準。",
    calendarFilename: "安心陪診-過後愛做个事.ics",
    shareHeading: "【安心陪診｜這擺看症重點】",
    shareReminder: "提醒：內容淨係整理，請以醫療院所正式个醫囑為準。",
    shareTitle: "這擺看症重點",
    loadingLogin: "確認等登入狀態…",
    authEyebrow: "醫生交代，清楚記得",
    authTitle: "用 Gmail 登入",
    authIntro: "輸入 Email，𠊎兜會寄一封安全登入个連結分你，毋使另外設定密碼。",
    emailLabel: "Gmail 抑係 Email",
    sendingLink: "寄等…",
    sendLink: "寄登入連結",
    authNotConfigured: "登入服務還吂設定好，請等一下再試。",
    authNoPassword: "毋使密碼",
    authSeparateData: "個人資料分開保存",
    authAnytimeSignOut: "幾時都做得登出",
    authSafety: "安心陪診淨係協助整理同提醒，毋會診斷抑係改醫囑。",
    loginSending: "寄等登入連結…",
    loginFailedPrefix: "寄毋出",
    loginSent: "登入連結寄出哩，請去 Gmail 信箱撳連結過後轉來這隻頁面。",
    previewSummary: "看症當中个錄音完成過後，醫病溝通重點會整理在這。",
    previewMedication: "照藥袋頂項標个擺數同時間食藥，毋好自家加減藥量。",
    previewTasks: [
      { id: "medication", title: "照藥袋指示食藥", detail: "朝晨暗晡食飽後服用；若係毋鬆爽，請照醫療院所指示聯絡", type: "medication" },
      { id: "blood-test", title: "8 月 26 以前完成抽血", detail: "照檢驗單个說明準備，愛記得帶健保卡", date: "2026-08-26", type: "test" },
      { id: "follow-up", title: "8 月 30 轉去看症", detail: "帶這擺个藥袋、檢驗結果同愛問醫生个問題", date: "2026-08-30", type: "visit" },
    ],
  },
} as const;

const documentKinds: Array<{ kind: DocumentKind; mark: string }> = [
  { kind: "藥袋", mark: "藥" },
  { kind: "預約單", mark: "約" },
  { kind: "衛教單", mark: "讀" },
];

function createPreviewTasks(locale: Locale): CareTask[] {
  return copy[locale].previewTasks.map((task) => ({ ...task, done: false }));
}

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

function chooseTaiwaneseFemaleVoice(voices: SpeechSynthesisVoice[]) {
  const naturalVoiceKeywords = [
    "natural",
    "enhanced",
    "premium",
    "siri",
    "google",
  ];
  const femaleVoiceKeywords = [
    "hsiaochen",
    "hsiao-chen",
    "hsiaoyu",
    "hsiao-yu",
    "yating",
    "hanhan",
    "meijia",
    "mei-jia",
    "美佳",
    "曉辰",
    "曉雨",
    "雅婷",
    "涵涵",
    "國語（臺灣）",
    "國語 (臺灣)",
  ];

  return voices
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-") === "zh-tw")
    .sort((voiceA, voiceB) => {
      const score = (voice: SpeechSynthesisVoice) => {
        const name = voice.name.toLowerCase();
        const femaleVoice = femaleVoiceKeywords.some((keyword) => name.includes(keyword)) ? 20 : 0;
        const naturalVoice = naturalVoiceKeywords.some((keyword) => name.includes(keyword)) ? 8 : 0;
        const localVoice = voice.localService ? 2 : 0;
        return femaleVoice + naturalVoice + localVoice;
      };

      return score(voiceB) - score(voiceA);
    })[0];
}

function makeSpeechFlowNaturally(text: string) {
  return text
    .replace(/\bAI\b/gi, "A，I")
    .replace(/\s+/g, " ")
    .replace(/([。！？；])(?=\S)/g, "$1 ")
    .trim();
}

const MAX_IMAGE_DATA_URL_LENGTH = 700_000;
const MAX_IMAGE_DIMENSION = 1_600;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file: File) {
  const original = await readFileAsDataUrl(file);
  if (original.length <= MAX_IMAGE_DATA_URL_LENGTH) return original;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const candidate = new Image();
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    candidate.src = original;
  });

  let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.82;
  let compressed = original;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length <= MAX_IMAGE_DATA_URL_LENGTH) return compressed;
    if (quality > 0.52) quality -= 0.1;
    else scale *= 0.82;
  }

  if (compressed.length > MAX_IMAGE_DATA_URL_LENGTH) throw new Error("IMAGE_TOO_LARGE");
  return compressed;
}

export function CareCompanion() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [largeText, setLargeText] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("care-text-size") === "large",
  );
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState<string[]>([...copy.zh.initialQuestions]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeKind, setActiveKind] = useState<DocumentKind>("藥袋");
  const [isListening, setIsListening] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [tasks, setTasks] = useState<CareTask[]>(() => createPreviewTasks("zh"));
  const [summary, setSummary] = useState(copy.zh.previewSummary);
  const [notice, setNotice] = useState("");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const speechPlayerRef = useRef<HTMLAudioElement | null>(null);
  const speechUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const t = copy[locale];

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    fetch("/api/config")
      .then((response) => response.json())
      .then(async (config) => {
        if (!config.configured) {
          if (active) {
            setAuthConfigured(false);
            setAuthReady(true);
          }
          return;
        }
        const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
          auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
        });
        const { data } = await client.auth.getSession();
        if (!active) return;
        setSupabase(client);
        setAuthSession(data.session);
        setAuthReady(true);
        const listener = client.auth.onAuthStateChange((_event, session) => {
          if (active) setAuthSession(session);
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) {
          setAuthConfigured(false);
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return () => documents.forEach((document) => URL.revokeObjectURL(document.preview));
  }, [documents]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingChunksRef.current = [];
    speechRequestRef.current?.abort();
    speechPlayerRef.current?.pause();
    if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const releaseSpeechAudio = () => {
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    speechPlayerRef.current?.pause();
    speechPlayerRef.current = null;
    if (speechUrlRef.current) URL.revokeObjectURL(speechUrlRef.current);
    speechUrlRef.current = null;
    window.speechSynthesis?.cancel();
  };

  const sendLoginLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !loginEmail.trim()) return;
    setLoginSubmitting(true);
    setAuthMessage(t.loginSending);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: true },
    });
    setAuthMessage(error ? t.loginFailedPrefix : t.loginSent);
    setLoginSubmitting(false);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  const changeLocale = (nextLocale: Locale) => {
    releaseSpeechAudio();
    setIsReading(false);
    setLocale(nextLocale);
    setQuestion("");
    setQuestions([...copy[nextLocale].initialQuestions]);
    setSummary(copy[nextLocale].previewSummary);
    setTasks(createPreviewTasks(nextLocale));
    setHasAnalyzed(false);
    setNotice("");
  };

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

  const speakWithDeviceVoice = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setIsReading(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "zh" ? "zh-TW" : locale === "nan" ? "nan-TW" : "hak-TW";
    utterance.voice = chooseTaiwaneseFemaleVoice(window.speechSynthesis.getVoices()) ?? null;
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const speak = async (text: string) => {
    if (isReading) {
      releaseSpeechAudio();
      setIsReading(false);
      return;
    }
    const naturalText = makeSpeechFlowNaturally(text);
    const controller = new AbortController();
    speechRequestRef.current = controller;
    setIsReading(true);
    try {
      if (!authSession?.access_token) throw new Error("AUTH_REQUIRED");
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ text: naturalText, locale }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("SPEECH_UNAVAILABLE");
      const audioUrl = URL.createObjectURL(await response.blob());
      if (controller.signal.aborted) {
        URL.revokeObjectURL(audioUrl);
        return;
      }
      speechRequestRef.current = null;
      speechUrlRef.current = audioUrl;
      const player = new Audio(audioUrl);
      speechPlayerRef.current = player;
      const finish = () => {
        releaseSpeechAudio();
        setIsReading(false);
      };
      player.onended = finish;
      player.onerror = finish;
      await player.play();
    } catch {
      const wasCancelled = controller.signal.aborted;
      releaseSpeechAudio();
      if (wasCancelled) setIsReading(false);
      else speakWithDeviceVoice(naturalText);
    }
  };

  const speakIntro = () => speak(`${t.titleA}${t.titleB} ${t.intro}`);

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

  const persistVisit = async (result: AnalysisResult, includeDocuments = true, includeSummary = true) => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: visit, error } = await supabase
      .from("care_visits")
      .insert({
        user_id: userData.user.id,
        questions,
        summary: includeSummary ? result.summary : "",
        medication_note: includeSummary ? result.medicationNote : "",
        tasks: result.tasks,
      })
      .select("id")
      .single();
    if (error || !visit) return;

    if (!includeDocuments) return;
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
  };

  const finishRecordingResources = () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const analyzeRecording = async (audio: Blob) => {
    if (!authSession?.access_token) {
      setNotice(t.expiredNotice);
      setRecordingState("idle");
      return;
    }
    setRecordingState("processing");
    setNotice("");
    try {
      const form = new FormData();
      const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      form.set("audio", audio, `visit.${extension}`);
      form.set("locale", locale);
      form.set("questions", JSON.stringify(questions));
      const response = await fetch("/api/analyze-audio", {
        method: "POST",
        headers: { Authorization: `Bearer ${authSession.access_token}` },
        body: form,
      });
      const responseBody = await response.json() as AnalysisResult | AnalysisError;
      if (!response.ok) throw new Error((responseBody as AnalysisError).error?.message || t.recordingFailed);
      const result = responseBody as AnalysisResult;
      if (!result.summary || !Array.isArray(result.tasks)) throw new Error(t.invalidAnalysis);
      setSummary(result.summary);
      setTasks((current) => {
        const additions = result.tasks.map((task) => ({ ...task, done: false }));
        const existing = hasAnalyzed ? current : [];
        return [...existing, ...additions].filter((task, index, all) =>
          all.findIndex((item) => item.title === task.title && item.detail === task.detail) === index,
        );
      });
      setHasAnalyzed(true);
      await persistVisit(result, false);
      setNotice(result.warnings.filter(Boolean).join(" "));
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.recordingFailed);
    } finally {
      setRecordingState("idle");
      setRecordingSeconds(0);
    }
  };

  const startRecording = async () => {
    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setNotice(t.microphoneUnavailable);
      return;
    }
    if (!window.confirm(t.recordingConsent)) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, { ...(preferredType ? { mimeType: preferredType } : {}), audioBitsPerSecond: 16_000 });
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const audio = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recordingChunksRef.current = [];
        finishRecordingResources();
        void analyzeRecording(audio);
      };
      recorder.start(1_000);
      setRecordingSeconds(0);
      setRecordingState("recording");
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds >= 1_799) {
            setNotice(t.recordingLimit);
            if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
          }
          return seconds + 1;
        });
      }, 1_000);
    } catch {
      finishRecordingResources();
      setNotice(t.microphoneDenied);
      setRecordingState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const analyze = async () => {
    if (documents.length === 0) {
      setNotice(t.noDocumentsNotice);
      return;
    }
    if (!authSession?.access_token) {
      setNotice(t.expiredNotice);
      return;
    }
    setIsAnalyzing(true);
    setNotice("");
    try {
      const payload = {
        locale,
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify(payload),
      });
      const responseBody = (await response.json()) as AnalysisResult | AnalysisError;
      if (!response.ok) {
        const error = responseBody as AnalysisError;
        if (error.error?.code?.startsWith("AUTH_") || error.error?.code === "SUPABASE_NOT_CONFIGURED") {
          throw new Error(t.expiredNotice);
        }
        throw new Error(error.error?.message || t.analyzeFailed);
      }
      const result = responseBody as AnalysisResult;
      if (!result.summary || !Array.isArray(result.tasks) || !Array.isArray(result.warnings)) {
        throw new Error(t.invalidAnalysis);
      }
      setTasks((current) => {
        const additions = result.tasks.map((task) => ({ ...task, done: false }));
        const existing = hasAnalyzed ? current : [];
        return [...existing, ...additions].filter((task, index, all) =>
          all.findIndex((item) => item.title === task.title && item.detail === task.detail) === index,
        );
      });
      setHasAnalyzed(true);
      await persistVisit(result, true, false);
      setNotice(result.warnings.filter(Boolean).join(" "));
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.analyzeFailed);
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
          `DESCRIPTION:${escapeIcs(task.detail)}\\n${escapeIcs(t.calendarDescription)}`,
          "END:VEVENT",
        ].join("\r\n");
      })
      .join("\r\n");
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Anxin Care//Care Tasks//ZH-TW\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = t.calendarFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareSummary = async () => {
    const text = [t.shareHeading, summary, "", ...tasks.map((task, index) => `${index + 1}. ${task.title}｜${task.detail}`), "", t.shareReminder].join("\n");
    if (navigator.share) {
      await navigator.share({ title: t.shareTitle, text }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text);
      setNotice(t.copied);
    }
  };

  if (!authReady) {
    return (
      <main className="auth-shell">
        <div className="auth-card auth-loading" role="status">
          <span className="brand-mark"><span>安</span></span>
          <strong>{t.brand}</strong>
          <p>{t.loadingLogin}</p>
        </div>
      </main>
    );
  }

  const isLocalDemo = !authConfigured && process.env.NODE_ENV !== "production";

  if (!authSession && !isLocalDemo) {
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-brand"><span className="brand-mark"><span>安</span></span><strong>{t.brand}</strong></div>
          <p className="auth-eyebrow">{t.authEyebrow}</p>
          <h1 id="login-title">{t.authTitle}</h1>
          <p className="auth-intro">{t.authIntro}</p>
          {authConfigured ? (
            <form className="login-form" onSubmit={sendLoginLink}>
              <label htmlFor="login-email">{t.emailLabel}</label>
              <input id="login-email" type="email" inputMode="email" autoComplete="email" placeholder="name@gmail.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
              <button type="submit" disabled={loginSubmitting}>{loginSubmitting ? t.sendingLink : t.sendLink}<span>→</span></button>
            </form>
          ) : (
            <div className="auth-error">{t.authNotConfigured}</div>
          )}
          {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
          <div className="auth-points"><span>✓ {t.authNoPassword}</span><span>✓ {t.authSeparateData}</span><span>✓ {t.authAnytimeSignOut}</span></div>
          <p className="auth-safety">{t.authSafety}</p>
        </section>
      </main>
    );
  }

  const viewerName = authSession?.user.email || t.localPreview;

  return (
    <main className="site-shell" data-text-size={largeText ? "large" : "normal"}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={t.homeLabel}>
          <span className="brand-mark"><span>安</span></span>
          <span>{t.brand}</span>
        </a>
        <nav aria-label={t.mainNavLabel}>
          <a href="#prepare">{t.navPrepare}</a>
          <a href="#visit">{t.navVisit}</a>
          <a href="#documents">{t.navDocuments}</a>
          <a href="#result">{t.navTasks}</a>
        </nav>
        <div className="accessibility-tools">
          <label className="language-select">
            <span>{t.language}</span>
            <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={t.selectLanguageLabel}>
              <option value="zh">華語</option>
              <option value="nan">台語</option>
              <option value="hak">客語</option>
            </select>
          </label>
          <button className={`size-button ${largeText ? "is-active" : ""}`} type="button" onClick={toggleLargeText} aria-pressed={largeText}>
            <span className="size-aa">A<span>A</span></span> {t.large}
          </button>
          <div className="account-menu">
            <span className="account-avatar" aria-hidden="true">{viewerName.slice(0, 1).toUpperCase()}</span>
            <span className="account-name">{viewerName}</span>
            <button type="button" onClick={signOut}>{t.signOut}</button>
          </div>
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
        </div>

        <div className="hero-visual" aria-label={t.heroVisualLabel}>
          <div className="summary-card">
            <div className="summary-card-top">
              <span className="mini-brand">安</span>
              <span><small>{t.brand} AI</small><strong>{t.miniReady}</strong></span>
              <span className="status-dot">{t.complete}</span>
            </div>
            <div className="doctor-note">
              <span className="doctor-avatar">醫</span>
              <div><strong>{t.doctorOrderTitle}</strong><p>{t.doctorOrderText}</p></div>
            </div>
            <ol className="mini-tasks">
              {t.miniTasks.map((task, index) => <li key={task.title}><span>{index + 1}</span><div><strong>{task.title}</strong><small>{task.detail}</small></div><b>{task.due}</b></li>)}
            </ol>
            <div className="mini-actions"><span>◷ {t.reminderSet}</span><span>＋ {t.addCalendar}</span></div>
          </div>
        </div>
      </section>

      <section className="step-ribbon" aria-label={t.stepsLabel}>
        {t.steps.map((step, index) => <div key={step}><span>{pad(index + 1)}</span><strong>{step}</strong>{index < t.steps.length - 1 && <i aria-hidden="true">→</i>}</div>)}
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
            <div className="list-label"><span>{t.questionList}</span><b>{questions.length} {t.questionUnit}</b></div>
            {questions.map((item, index) => (
              <div className="question-item" key={`${item}-${index}`}>
                <span>{index + 1}</span><p>{item}</p>
                <button type="button" aria-label={`${t.deleteQuestionLabel}：${item}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="suggestion-row">
          <span>{t.commonQuestions}</span>
          {t.suggestions.map((item) => <button key={item} type="button" onClick={() => addQuestion(item)}>＋ {item}</button>)}
        </div>
      </section>

      <section className="workflow-section visit-section" id="visit">
        <div className="section-heading">
          <p>{t.visitKicker}</p>
          <h2>{t.visitTitle}</h2>
          <span>{t.visitIntro}</span>
        </div>
        <div className={`recording-card ${recordingState === "recording" ? "is-recording" : ""}`}>
          <div className="recording-copy">
            <span className="recording-dot" aria-hidden="true" />
            <div><strong>{t.recordingTitle}</strong><p>{t.recordingIntro}</p></div>
          </div>
          <div className="recording-actions">
            {recordingState === "recording" && <time>{`${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")}`}</time>}
            <button
              type="button"
              className="recording-button"
              disabled={recordingState === "processing"}
              onClick={recordingState === "recording" ? stopRecording : startRecording}
            >
              {recordingState === "recording" ? t.stopRecording : recordingState === "processing" ? t.processingRecording : t.startRecording}
            </button>
          </div>
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
            const documentCopy = t.documentKinds[item.kind];
            return (
              <button className="document-card" type="button" key={item.kind} onClick={() => chooseFiles(item.kind)}>
                <span className="document-mark">{item.mark}</span>
                <span><strong>{documentCopy.label}</strong><small>{documentCopy.hint}</small></span>
                <b>{count > 0 ? `${count} ${t.uploaded}` : "＋"}</b>
              </button>
            );
          })}
        </div>
        {documents.length > 0 && (
          <div className="photo-strip" aria-label={t.selectedPhotosLabel}>
            {documents.map((document, index) => (
              <div className="photo-thumb" key={`${document.file.name}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={document.preview} alt={`${t.documentKinds[document.kind].label}：${document.file.name}`} />
                <span>{t.documentKinds[document.kind].label}</span>
                <button type="button" aria-label={`${t.removePhotoLabel}：${document.file.name}`} onClick={() => setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
        )}
        <button className="analyze-button" type="button" onClick={analyze} disabled={isAnalyzing || documents.length === 0}>
          <span className="ai-spark">✦</span>
          {isAnalyzing ? t.analyzing : t.analyze}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className={`result-section ${hasAnalyzed ? "is-ready" : ""}`} id="result" ref={resultRef}>
        <div className="section-heading result-heading">
          <p>{t.summaryKicker}</p>
          <h2>{t.summaryTitle}</h2>
          <span>{hasAnalyzed ? t.ready : t.previewIntro}</span>
        </div>
        <div className="result-layout">
          <div className="result-main">
            <div className="visit-summary">
              <div className="summary-icon">{t.summaryMark}</div>
              <div><span>{t.summaryLabel}</span><p>{summary}</p><small className="speech-disclosure">{t.speechDisclosure}</small></div>
              <button type="button" onClick={() => speak(summary)}>{isReading ? "■" : "▶"}<span>{isReading ? t.stopRead : t.read}</span></button>
            </div>
            <div className="task-header"><strong>{t.tasksLabel}</strong><span>{completedCount} / {tasks.length} {t.completedLabel}</span></div>
            <div className="task-list">
              {tasks.length === 0 ? <div className="task-empty">{t.noTasks}</div> : tasks.map((task, index) => (
                <article className={`task-card ${task.done ? "is-done" : ""}`} key={task.id}>
                  <button className="task-check" type="button" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} aria-label={`${task.done ? t.markUndoneLabel : t.markDoneLabel}：${task.title}`}>{task.done ? "✓" : index + 1}</button>
                  <div className="task-copy"><strong>{task.title}</strong><p>{task.detail}</p></div>
                  {task.date ? <button className="calendar-one" type="button" onClick={() => downloadCalendar([task])}><span>＋</span>{t.calendarOne}</button> : <span className="today-pill">{t.everyDay}</span>}
                </article>
              ))}
            </div>
          </div>
          <aside className="family-card">
            <div className="family-orbit"><span>{t.familyMark}</span><i>✓</i></div>
            <h3>{t.familyTitle}</h3>
            <p>{t.familyText}</p>
            <button type="button" onClick={() => downloadCalendar()}><span>▣</span>{t.calendar}</button>
            <button type="button" className="share-button" onClick={shareSummary}><span>↗</span>{t.share}</button>
          </aside>
        </div>
        {notice && <div className="toast" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label={t.closeNoticeLabel}>×</button></div>}
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark"><span>安</span></span><div><strong>{t.brand}</strong><small>{t.footerTagline}</small></div></div>
        <p><strong>{t.footerNoticeTitle}</strong>{"　"}{t.footerNoticeText}</p>
      </footer>
    </main>
  );
}
