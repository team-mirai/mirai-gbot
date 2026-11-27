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
  description: "行政手続きや公的制度について相談できる行政相談用チャットボット",
};

// 保存済みの文字サイズを描画前に反映し、標準サイズで一瞬表示されるのを防ぐ
const fontSizeInit = `try{var f=localStorage.getItem("mirai-gbot:font-size");if(f==="large"||f==="xlarge")document.documentElement.dataset.fontSize=f}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 初期化スクリプトが data-font-size を付けるため、属性差分の警告を抑止する
    <html lang="ja" className={notoSansJp.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontSizeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
