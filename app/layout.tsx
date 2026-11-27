import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mirai-gbot",
  description: "シンプルなチャットボット",
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
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontSizeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
