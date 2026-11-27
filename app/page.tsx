"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string };
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
    const history: Message[] = [...prev, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, mode: currentMode }),
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
      setMessages([...history, { role: "assistant", content: `[${msg}]` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="header">
        <span>mirai-gbot</span>
        {mode === "support" && <span className="mode-badge">支援制度を探す</span>}
        {messages.length > 0 && (
          <button type="button" className="header-button" onClick={resetChat} disabled={loading}>
            最初に戻る
          </button>
        )}
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <p>何でも聞いてください。</p>
            <button type="button" className="mode-button" onClick={startSupport}>
              使える支援制度を探す
            </button>
            <p className="note">
              いくつかの質問にお答えいただくと、利用できそうな給付・手当・減免・相談窓口をご案内します。
              お名前や詳しい住所などの個人情報は入力しないでください。
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "assistant" && m.content ? (
              <Markdown text={m.content} />
            ) : (
              m.content || (loading ? "…" : "")
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "support" ? "状況を入力（個人情報は不要です）" : "メッセージを入力"}
          disabled={loading}
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          送信
        </button>
      </form>
    </main>
  );
}
