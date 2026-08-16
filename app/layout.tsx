import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "安心照護｜外籍看護 × 家屬照護翻譯 AI",
  description: "用 AI 即時翻譯、拆解照護步驟，讓外籍看護與家屬溝通更安心。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
