"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { FuriganaContext, FuriganaText } from "./Furigana";

const FURIGANA_KEY = "mirai-gbot:furigana";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [furigana, setFurigana] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 振り仮名の設定はブラウザごとに記憶する（読めない環境でも動作には影響しない）
  useEffect(() => {
    try {
      if (localStorage.getItem(FURIGANA_KEY) === "on") setFurigana(true);
    } catch {}
  }, []);

  function toggleFurigana() {
    const next = !furigana;
    setFurigana(next);
    try {
      localStorage.setItem(FURIGANA_KEY, next ? "on" : "off");
    } catch {}
  }

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
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
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
    <FuriganaContext.Provider value={furigana}>
    <main className={`container${furigana ? " furigana-on" : ""}`}>
      <header className="header">
        <div className="header-inner">
          <h1 className="header-title">mirai-gbot</h1>
          <p className="header-description">
            <FuriganaText text="AI チャットボット" />
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={furigana}
            className="furigana-toggle"
            onClick={toggleFurigana}
          >
            <span className="furigana-toggle-label">
              <ruby>
                振<rp>(</rp><rt>ふ</rt><rp>)</rp>
              </ruby>
              り
              <ruby>
                仮名<rp>(</rp><rt>がな</rt><rp>)</rp>
              </ruby>
            </span>
            <span className="furigana-toggle-track" aria-hidden="true">
              <span className="furigana-toggle-thumb" />
            </span>
            <span className="furigana-toggle-state" aria-hidden="true">
              {furigana ? "オン" : "オフ"}
            </span>
          </button>
        </div>
      </header>

      <section className="messages" aria-label="会話">
        <div className="messages-inner" aria-live="polite">
          {messages.length === 0 && (
            <p className="empty">
              <FuriganaText text="何でも聞いてください。" />
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
              {/* 生成中のメッセージは文字列が変わり続けるため、完了してから振り仮名を付ける */}
              <FuriganaContext.Provider
                value={furigana && !(loading && i === messages.length - 1)}
              >
                <div className="bubble" role={m.error ? "alert" : undefined}>
                  {m.role === "assistant" && m.content && !m.error ? (
                    <Markdown text={m.content} />
                  ) : m.content ? (
                    <FuriganaText text={m.content} />
                  ) : loading ? (
                    <span className="typing">回答を作成中…</span>
                  ) : (
                    ""
                  )}
                </div>
              </FuriganaContext.Provider>
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
            placeholder="メッセージを入力"
            disabled={loading}
            autoComplete="off"
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
    </FuriganaContext.Provider>
  );
}
