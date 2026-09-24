import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Magic Code - 指哪打哪的 AI 交互助手",
  description: "在同一工作台中对话、指向、批注并修改 AI 生成内容。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
