import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
// デジタル庁デザインシステム公式デザイントークン（CSS カスタムプロパティ）
import "@digital-go-jp/design-tokens/dist/tokens.css";
import "./globals.css";

// デジタル庁デザインシステムの標準書体 Noto Sans JP
const notoSansJp = Noto_Sans_JP({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "mirai-gbot",
  description: "シンプルなチャットボット",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      <body>{children}</body>
    </html>
  );
}
