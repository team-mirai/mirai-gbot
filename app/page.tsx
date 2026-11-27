"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

const GREETINGS: [string, string][] = [
  ["こんにちは", "。"],
  ["Hello", "."],
  ["你好", "。"],
  ["안녕하세요", "."],
  ["Xin chào", "."],
  ["Olá", "."],
];

const SUGGESTIONS = [
  "引っ越しのときに必要な手続きは？",
  "児童手当はどうやって申請する？",
  "マイナンバーカードの更新方法",
  "確定申告が必要なのはどんな人？",
];

const TOPICS = [
  { title: "くらし・住まい", desc: "転入・転出、住民票、戸籍", q: "転入届の出し方と必要なものを教えて" },
  { title: "子育て・教育", desc: "出産、児童手当、保育園", q: "子どもが生まれたら必要な手続きは？" },
  { title: "税金", desc: "確定申告、住民税、控除", q: "確定申告のやり方をざっくり教えて" },
  { title: "年金・保険", desc: "国民年金、健康保険", q: "会社を辞めたら年金と健康保険はどうなる？" },
  { title: "健康・福祉", desc: "介護、障害福祉、医療費", q: "親の介護が必要になったらまず何をすればいい？" },
  { title: "仕事", desc: "失業給付、職業訓練", q: "失業手当をもらうための手続きは？" },
  { title: "防災・災害", desc: "避難、被災者支援", q: "災害で家が被害を受けたときに使える支援は？" },
  { title: "マイナンバー", desc: "カード、マイナポータル", q: "マイナンバーカードでできることは？" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greeting, setGreeting] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inChat = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inChat) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setGreeting((g) => (g + 1) % GREETINGS.length), 2600);
    return () => clearInterval(id);
  }, [inChat]);

  async function send(raw: string) {
    const text = raw.trim();
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function reset() {
    if (loading) return;
    setMessages([]);
    setInput("");
    window.scrollTo({ top: 0 });
  }

  const brand = (
    <button type="button" className="brand" onClick={reset} aria-label="mirai-gbot トップに戻る">
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
    </button>
  );

  if (!inChat) {
    return (
      <div className="landing">
        <div className="notice">
          AI がお答えする行政相談のご案内です。正式な手続きは各行政機関の窓口・公式サイトでご確認ください。
        </div>

        <header className="header">
          <div className="header-inner">{brand}</div>
        </header>

        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-inner">
              <h1 id="hero-title" className="hello">
                <span key={greeting} className="hello-word">
                  {GREETINGS[greeting][0]}
                  {GREETINGS[greeting][1]}
                </span>
              </h1>
              <p className="hero-lead">
                行政の手続きや制度について、何をお知りになりたいですか？
              </p>

              <form className="ask" onSubmit={handleSubmit}>
                <label htmlFor="ask-input" className="visually-hidden">
                  相談したい内容
                </label>
                <input
                  id="ask-input"
                  className="text-field ask-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="例：引っ越したら何をすればいい？"
                  autoFocus
                  autoComplete="off"
                />
                <button type="submit" className="button-primary ask-button" disabled={!input.trim()}>
                  聞いてみる
                </button>
              </form>

              <div className="suggestions">
                <p className="suggestions-label">よくある質問</p>
                <ul>
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button type="button" className="chip" onClick={() => send(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="topics" aria-labelledby="topics-title">
            <div className="section-inner">
              <h2 id="topics-title">テーマから探す</h2>
              <ul className="topic-grid">
                {TOPICS.map((t) => (
                  <li key={t.title}>
                    <button type="button" className="topic" onClick={() => send(t.q)}>
                      <span className="topic-title">{t.title}</span>
                      <span className="topic-desc">{t.desc}</span>
                      <span className="topic-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="section-inner">
            24 時間いつでも、日本語以外の言語でもご相談いただけます。
            <br />
            AI の回答には誤りが含まれる場合があります。個人情報は入力しないでください。
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-inner chat-header">
          {brand}
          <button type="button" className="button-secondary" onClick={reset} disabled={loading}>
            新しい相談
          </button>
        </div>
      </header>

      <main className="messages" aria-label="会話">
        <div className="messages-inner" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}${m.error ? " error" : ""}`}>
              <span className="message-label">
                {m.role === "user" ? "あなた" : m.error ? "エラー" : "mirai-gbot"}
              </span>
              <div className="bubble" role={m.error ? "alert" : undefined}>
                {m.role === "assistant" && m.content && !m.error ? (
                  <Markdown text={m.content} />
                ) : (
                  m.content || (loading ? <span className="typing">回答を作成中…</span> : "")
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

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
            placeholder="続けて質問する"
            disabled={loading}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="button-primary" disabled={loading || !input.trim()}>
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
