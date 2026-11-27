"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string };

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
  { icon: "🏠", title: "くらし・住まい", desc: "転入・転出、住民票、戸籍", q: "転入届の出し方と必要なものを教えて" },
  { icon: "👶", title: "子育て・教育", desc: "出産、児童手当、保育園", q: "子どもが生まれたら必要な手続きは？" },
  { icon: "💴", title: "税金", desc: "確定申告、住民税、控除", q: "確定申告のやり方をざっくり教えて" },
  { icon: "🧓", title: "年金・保険", desc: "国民年金、健康保険", q: "会社を辞めたら年金と健康保険はどうなる？" },
  { icon: "🩺", title: "健康・福祉", desc: "介護、障害福祉、医療費", q: "親の介護が必要になったらまず何をすればいい？" },
  { icon: "💼", title: "仕事", desc: "失業給付、職業訓練", q: "失業手当をもらうための手続きは？" },
  { icon: "🌀", title: "防災・災害", desc: "避難、被災者支援", q: "災害で家が被害を受けたときに使える支援は？" },
  { icon: "🪪", title: "マイナンバー", desc: "カード、マイナポータル", q: "マイナンバーカードでできることは？" },
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
    <button type="button" className="brand" onClick={reset} aria-label="トップに戻る">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="currentColor" />
        <path
          d="M21.66 10.34A8 8 0 1 0 24 16H17"
          fill="none"
          stroke="var(--brand-fg)"
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

        <header className="site-header">
          <div className="wrap">{brand}</div>
        </header>

        <section className="hero">
          <div className="wrap hero-inner">
            <h1 className="hello">
              <span key={greeting} className="hello-word">
                {GREETINGS[greeting][0]}
                <span className="hello-dot">{GREETINGS[greeting][1]}</span>
              </span>
            </h1>
            <p className="hero-lead">
              行政の手続きや制度について、何をお知りになりたいですか？
            </p>

            <form className="ask" onSubmit={handleSubmit}>
              <label htmlFor="ask-input" className="sr-only">
                相談したい内容
              </label>
              <input
                id="ask-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="例：引っ越したら何をすればいい？"
                autoFocus
                autoComplete="off"
              />
              <button type="submit" disabled={!input.trim()}>
                聞いてみる
              </button>
            </form>

            <div className="suggestions" aria-label="よくある質問">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="topics">
          <div className="wrap">
            <h2>テーマから探す</h2>
            <div className="topic-grid">
              {TOPICS.map((t) => (
                <button key={t.title} type="button" className="topic" onClick={() => send(t.q)}>
                  <span className="topic-icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="topic-title">{t.title}</span>
                  <span className="topic-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="wrap">
            24 時間いつでも、日本語以外の言語でもご相談いただけます。
            <br />
            AI の回答には誤りが含まれる場合があります。個人情報は入力しないでください。
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="chat">
      <header className="site-header">
        <div className="wrap chat-header">
          {brand}
          <button type="button" className="new-chat" onClick={reset} disabled={loading}>
            ＋ 新しい相談
          </button>
        </div>
      </header>

      <main className="messages">
        <div className="messages-inner">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.role === "assistant" && m.content ? (
                <Markdown text={m.content} />
              ) : (
                m.content || (loading ? <span className="typing" aria-label="回答を作成中"><i /><i /><i /></span> : "")
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="続けて質問する"
            disabled={loading}
            autoFocus
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
