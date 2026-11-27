"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

// 入力欄のプレースホルダーに順番に表示する質問の例。
// どんなことを聞けばよいかの手がかりになるよう、身近な行政手続きを選んでいる。
const EXAMPLE_QUESTIONS = [
  "引っ越したときに必要な手続きは？",
  "児童手当の申請方法を教えて",
  "マイナンバーカードの作り方は？",
  "パスポートの更新に必要なものは？",
  "確定申告が必要なのはどんな人？",
  "国民健康保険の保険料を減らせる？",
];
const PLACEHOLDER_INTERVAL_MS = 4000;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 入力が空のあいだだけ、質問例を一定間隔で切り替える
  useEffect(() => {
    if (input || loading) return;
    const id = setInterval(
      () => setExampleIndex((i) => (i + 1) % EXAMPLE_QUESTIONS.length),
      PLACEHOLDER_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [input, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history: Message[] = [
      ...messages.filter((m) => !m.error),
      { role: "user", content: text },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // サーバー側の上限（20 件）に合わせて直近の履歴だけ送る
        body: JSON.stringify({
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "エラーが発生しました。";
      setMessages([...history, { role: "assistant", content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="header">
        <div className="header-inner">
          <h1 className="header-title">mirai-gbot</h1>
          <p className="header-description">AI チャットボット</p>
        </div>
      </header>

      <section className="messages" aria-label="会話">
        <div className="messages-inner" aria-live="polite">
          {messages.length === 0 && (
            <p className="empty">
              行政手続きや公的制度について聞いてください。
              <br />
              マイナンバー・氏名・住所・電話番号などの個人情報は入力しないでください。
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`message ${m.role}${m.error ? " error" : ""}`}
            >
              <span className="message-label">
                {m.role === "user" ? "あなた" : m.error ? "エラー" : "mirai-gbot"}
              </span>
              <div className="bubble" role={m.error ? "alert" : undefined}>
                {m.role === "assistant" && m.content && !m.error ? (
                  <Markdown text={m.content} />
                ) : (
                  m.content ||
                  (loading ? <span className="typing">回答を作成中…</span> : "")
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-inner">
          <label htmlFor="message-input" className="visually-hidden">
            メッセージ
          </label>
          <input
            id="message-input"
            className="text-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`例：${EXAMPLE_QUESTIONS[exampleIndex]}`}
            disabled={loading}
            autoComplete="off"
            maxLength={2000}
            autoFocus
          />
          <button
            type="submit"
            className="button-primary"
            disabled={loading || !input.trim()}
          >
            送信
          </button>
        </div>
      </form>
    </main>
  );
}
