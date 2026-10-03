# 安心陪診

給長輩、陪診者與家屬使用的看診整理工具：看診前記問題、拍藥袋／預約單／衛教單，由 AI 整理重點、後續待辦與日曆提醒。產品只整理與提醒，不做疾病診斷或更改醫囑。

## 本機開發

```bash
npm install
npm run dev
```

## 檢查與部署

```bash
npm run lint
npm run build
npm run build:netlify
```

- Netlify 設定在 `netlify.toml`，Functions 位於 `netlify/functions/`。
- Supabase SQL 位於 `supabase/migrations/`；請在 Supabase 啟用 Anonymous Sign-ins。
- 環境變數範例在 `.env.example`。公開端只取得 Supabase publishable key，OpenAI 與 Supabase secret key 僅留在伺服器端。
- 正式環境請把 `OPENAI_API_KEY` 設為 Netlify 的加密 Secret，絕對不要寫入 GitHub 或任何前端環境變數。
- 預設使用 `gpt-4o-mini` 整理照片與摘要、`gpt-transcribe` 轉錄看診錄音、`gpt-4o-mini-tts` 產生朗讀。這些名稱可用環境變數覆寫。

## 資料安全

Supabase 表格與 Storage bucket 均啟用 Row Level Security，每位登入使用者只能讀寫自己的看診紀錄與文件。錄音只在瀏覽器記憶體與伺服器端請求期間暫時處理，不會寫入 Supabase、Storage 或網站檔案；整理完成後只保存摘要與待辦。正式上線前仍應完成隱私權、資料保存期限、刪除機制與醫療法規審查。
