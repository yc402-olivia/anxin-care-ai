# 安心陪診2

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
- `OPENAI_VISION_MODEL` 需填入帳號可用、支援圖片輸入的模型名稱；未設定時網站會安全顯示示範整理結果。

## 資料安全

Supabase 表格與 Storage bucket 均啟用 Row Level Security，每位匿名登入使用者只能讀寫自己的看診紀錄與文件。正式上線前仍應完成隱私權、資料保存期限、刪除機制與醫療法規審查。
