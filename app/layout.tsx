import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美团粒粒",
  description: "本地短时出游规划 Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
