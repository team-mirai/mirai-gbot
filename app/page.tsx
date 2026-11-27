"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };
// "chat": 通常の行政相談 / "support": 使える支援制度を探す（AI インタビュー）
type Mode = "chat" | "support";

const SUPPORT_START = "使える支援制度を探したいです。";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text, messages, mode);
  }

  // 支援制度探しモードを新しい会話として始める（それまでの相談内容は送らない）
  function startSupport() {
    if (loading) return;
    setMode("support");
    send(SUPPORT_START, [], "support");
  }

  function resetChat() {
    if (loading) return;
    setMode("chat");
    setMessages([]);
  }

  async function send(text: string, prev: Message[], currentMode: Mode) {
    const history: Message[] = [
      ...prev.filter((m) => !m.error),
      { role: "user", content: text },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // サーバー側の上限（20 件）に合わせて直近の履歴だけ送る
        body: JSON.stringify({
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
          mode: currentMode,
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
          {mode === "support" ? (
            <span className="mode-badge">支援制度を探す</span>
          ) : (
            <p className="header-description">AI チャットボット</p>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              className="header-button"
              onClick={resetChat}
              disabled={loading}
            >
              最初に戻る
            </button>
          )}
        </div>
      </header>

      <section className="messages" aria-label="会話">
        <div className="messages-inner" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <p>
                行政手続きや公的制度について聞いてください。
                <br />
                マイナンバー・氏名・住所・電話番号などの個人情報は入力しないでください。
              </p>
              <button type="button" className="mode-button" onClick={startSupport}>
                使える支援制度を探す
              </button>
              <p className="note">
                いくつかの質問にお答えいただくと、利用できそうな給付・手当・減免・相談窓口をご案内します。
              </p>
            </div>
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
            placeholder={
              mode === "support" ? "状況を入力（個人情報は不要です）" : "メッセージを入力"
            }
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
