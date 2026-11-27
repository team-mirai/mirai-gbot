import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mirai-gbot",
  description: "行政手続きや公的制度について相談できる行政相談用チャットボット",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
