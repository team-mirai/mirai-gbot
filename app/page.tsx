"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { useSpeechRecognition } from "./useSpeechRecognition";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 音声入力開始時点で入力欄にあったテキスト（認識結果はこの後ろに追記する）
  const voiceBaseRef = useRef("");
  const speech = useSpeechRecognition((transcript) => {
    setInput(voiceBaseRef.current + transcript);
  });

  function toggleVoiceInput() {
    if (speech.listening) {
      speech.stop();
    } else {
      voiceBaseRef.current = input;
      speech.start();
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    speech.cancel();

    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
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
      <header className="header">mirai-gbot</header>

      <div className="messages">
        {messages.length === 0 && (
          <p className="empty">何でも聞いてください。</p>
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
          placeholder={speech.listening ? "お話しください…" : "メッセージを入力"}
          disabled={loading}
          autoFocus
        />
        {speech.supported && (
          <button
            type="button"
            className={`mic${speech.listening ? " listening" : ""}`}
            onClick={toggleVoiceInput}
            disabled={loading}
            aria-label={speech.listening ? "音声入力を停止" : "音声で入力"}
            aria-pressed={speech.listening}
            title={speech.listening ? "音声入力を停止" : "音声で入力"}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
              />
            </svg>
          </button>
        )}
        <button type="submit" disabled={loading || !input.trim()}>
          送信
        </button>
      </form>
      {speech.error && (
        <p className="voice-error" role="alert">
          {speech.error}
        </p>
      )}
    </main>
  );
}
