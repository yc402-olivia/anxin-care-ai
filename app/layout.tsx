import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL || "http://localhost:3000"),
  title: "安心陪診 AI｜把醫生交代整理成清楚待辦",
  description: "看診前整理問題、拍下藥袋與預約單，AI 幫長輩和家人整理重要資訊、後續待辦與日曆提醒。只整理提醒，不診斷疾病。",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    title: "安心陪診 AI｜醫生交代，清楚記得",
    description: "把藥袋、預約單與衛教單整理成家人都看得懂的後續待辦。只整理與提醒，不提供診斷。",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "安心陪診 AI 分享封面" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "安心陪診 AI｜醫生交代，清楚記得",
    description: "把看診資料整理成清楚待辦與日曆提醒。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
