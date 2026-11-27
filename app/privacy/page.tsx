import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用上の注意とプライバシー | mirai-gbot",
  description: "mirai-gbot の利用上の注意と、入力内容の扱いについて",
};

export default function PrivacyPage() {
  return (
    <main className="container">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="mirai-gbot トップに戻る">
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="currentColor" />
              <path
                d="M21.66 10.34A8 8 0 1 0 24 16H17"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="brand-name">
              mirai-gbot
              <small>行政相談 AI アシスタント</small>
            </span>
          </Link>
        </div>
      </header>

      <article className="doc">
        <h1>利用上の注意とプライバシー</h1>

        <h2>個人情報は入力しないでください</h2>
        <p>
          氏名、住所、電話番号、メールアドレス、マイナンバー、口座番号、病歴など、個人を特定できる情報や機微な情報は入力しないでください。
          ご相談の際は「60代・年金生活」のように、個人が特定されない形で状況をお伝えください。
        </p>

        <h2>入力内容の扱い</h2>
        <ul>
          <li>
            <strong>このアプリでの保存:</strong>{" "}
            mirai-gbot のサーバーは、入力内容や会話履歴をデータベース等に保存しません。会話はお使いのブラウザの画面上にだけ保持され、ページを再読み込みしたり閉じたりすると消えます。
          </li>
          <li>
            <strong>外部 AI サービスへの送信:</strong>{" "}
            回答を生成するため、入力内容（それまでの会話を含む）は{" "}
            <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">
              OpenRouter
            </a>{" "}
            を経由して AI モデルの提供元（既定では Anthropic の Claude）に送信されます。
            最新情報を調べるため、入力内容をもとにした Web 検索が行われる場合があります。
          </li>
          <li>
            <strong>AI の学習への利用:</strong>{" "}
            このアプリの運営者が、入力内容を AI の学習用データとして提供・利用することはありません。
            ただし、送信先の外部サービスでのデータの保持・利用は各社のポリシーに従います。詳しくは{" "}
            <a
              href="https://openrouter.ai/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenRouter のプライバシーポリシー
            </a>
            や、各モデル提供元のポリシーをご確認ください。
          </li>
        </ul>

        <h2>回答についての免責</h2>
        <p>
          回答は AI が自動で生成したもので、誤りや古い情報を含む可能性があります。
          制度や手続きの詳細、ご自身が対象になるかどうかなどは、必ず自治体や担当の行政機関の公式情報・窓口でご確認ください。
          本サービスの回答を利用したことによって生じた結果について、運営者は責任を負いかねます。
        </p>

        <p>
          <Link href="/">← チャットに戻る</Link>
        </p>
      </article>
    </main>
  );
}
