"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

type Message = { role: "user" | "assistant"; content: string };

// 文字サイズ（html 要素の data-font-size 属性で切り替え。CSS 側は rem 指定）
const FONT_SIZES = [
  { value: "normal", label: "標準" },
  { value: "large", label: "大" },
  { value: "xlarge", label: "特大" },
] as const;
type FontSize = (typeof FONT_SIZES)[number]["value"];

// 設定はブラウザに保存する（layout.tsx の初期化スクリプトと同じキー）
const FONT_SIZE_KEY = "mirai-gbot:font-size";
const EASY_JAPANESE_KEY = "mirai-gbot:easy-japanese";

function isFontSize(v: string | null): v is FontSize {
  return FONT_SIZES.some((f) => f.value === v);
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // プライベートモード等で保存できなくても動作は続ける
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [easyJapanese, setEasyJapanese] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 保存済みの設定を復元（SSR とのずれを避けるためマウント後に読む）
  useEffect(() => {
    try {
      const f = localStorage.getItem(FONT_SIZE_KEY);
      if (isFontSize(f)) setFontSize(f);
      setEasyJapanese(localStorage.getItem(EASY_JAPANESE_KEY) === "true");
    } catch {
      // 読めなければ既定値のまま
    }
  }, []);

  function changeFontSize(value: FontSize) {
    setFontSize(value);
    document.documentElement.dataset.fontSize = value;
    save(FONT_SIZE_KEY, value);
  }

  function changeEasyJapanese(value: boolean) {
    setEasyJapanese(value);
    save(EASY_JAPANESE_KEY, String(value));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, easyJapanese }),
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
        <h1 className="title">mirai-gbot</h1>
        <div className="settings">
          <div className="font-size" role="group" aria-label="文字サイズ">
            <span className="settings-label" aria-hidden="true">
              文字サイズ
            </span>
            {FONT_SIZES.map((f) => (
              <button
                key={f.value}
                type="button"
                className="toggle"
                aria-pressed={fontSize === f.value}
                onClick={() => changeFontSize(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="easy-japanese">
            <input
              type="checkbox"
              checked={easyJapanese}
              onChange={(e) => changeEasyJapanese(e.target.checked)}
            />
            やさしい日本語
          </label>
        </div>
      </header>

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
          placeholder="メッセージを入力"
          aria-label="メッセージ"
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
