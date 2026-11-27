import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mirai-gbot",
  description: "行政の手続きや制度について AI に相談できるチャットボット",
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
