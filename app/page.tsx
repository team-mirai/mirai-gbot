"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { useSpeechRecognition } from "./useSpeechRecognition";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  type Locale,
  MESSAGES,
  detectLocale,
  isLocale,
} from "./i18n";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };
// "chat": 通常の行政相談 / "support": 使える支援制度を探す（AI インタビュー）
type Mode = "chat" | "support";

// 手動で選んだ表示言語を保存するキー
const LOCALE_STORAGE_KEY = "mirai-gbot-locale";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = MESSAGES[locale];
  const bottomRef = useRef<HTMLDivElement>(null);
  // 音声入力開始時点で入力欄にあったテキスト（認識結果はこの後ろに追記する）
  const voiceBaseRef = useRef("");
  const speech = useSpeechRecognition((transcript) => {
    setInput(voiceBaseRef.current + transcript);
  }, LOCALE_TAGS[locale]);

  // 初期言語: 手動で選んだ言語 → ブラウザの言語設定 → 日本語。
  // SSR とのハイドレーション不一致を避けるため、マウント後に決める。
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // localStorage が使えない環境（プライベートモード等）は無視する
    }
    setLocale(isLocale(saved) ? saved : detectLocale(navigator.languages ?? [navigator.language]));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function changeLocale(value: string) {
    if (!isLocale(value)) return;
    speech.cancel();
    setLocale(value);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      // 保存できなくても切り替え自体は行う
    }
  }

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  // 支援制度探しモードを新しい会話として始める（それまでの相談内容は送らない）
  function startSupport() {
    if (loading) return;
    setMode("support");
    send(t.supportStart, [], "support");
  }

  function resetChat() {
    if (loading) return;
    setMode("chat");
    setMessages([]);
  }

  async function send(rawText: string, prev: Message[] = messages, currentMode: Mode = mode) {
    const text = rawText.trim();
    if (!text || loading) return;
    speech.cancel();

    const history: Message[] = [
      ...prev.filter((m) => !m.error),
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
          mode: currentMode,
          locale,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        // サーバーのエラーメッセージは日本語なので、日本語以外では表示言語の汎用メッセージにする
        throw new Error(
          locale === "ja" && detail
            ? detail
            : res.status === 429
              ? t.errorBusy
              : t.errorGeneric,
        );
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
      const msg = err instanceof Error && err.message ? err.message : t.errorGeneric;
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
            <span className="mode-badge">{t.supportBadge}</span>
          ) : (
            <p className="header-description">{t.description}</p>
          )}
          <div className="header-actions">
            <label htmlFor="locale-select" className="visually-hidden">
              {t.language}
            </label>
            <select
              id="locale-select"
              className="locale-select"
              value={locale}
              onChange={(e) => changeLocale(e.target.value)}
              title={t.language}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
            {messages.length > 0 && (
              <button
                type="button"
                className="header-button"
                onClick={resetChat}
                disabled={loading}
              >
                {t.reset}
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="messages" aria-label={t.conversation}>
        <div className="messages-inner" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <p>{t.welcome}</p>
              <p>{t.privacy}</p>
              <p className="empty-sub">{t.examplesLead}</p>
              <div className="examples">
                {t.examples.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="example"
                    onClick={() => send(q)}
                    disabled={loading}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button type="button" className="mode-button" onClick={startSupport}>
                {t.supportButton}
              </button>
              <p className="note">{t.supportNote}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`message ${m.role}${m.error ? " error" : ""}`}
            >
              {m.role === "assistant" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src="/bot-avatar.png" alt="" width={40} height={40} />
              )}
              <div className="message-body">
                <span className="message-label">
                  {m.role === "user" ? t.you : m.error ? t.error : "mirai-gbot"}
                </span>
                <div className="bubble" role={m.error ? "alert" : undefined}>
                  {m.role === "assistant" && m.content && !m.error ? (
                    <Markdown text={m.content} />
                  ) : (
                    m.content ||
                    (loading ? <span className="typing">{t.typing}</span> : "")
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-inner">
          <label htmlFor="message-input" className="visually-hidden">
            {t.inputLabel}
          </label>
          <input
            id="message-input"
            className="text-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              speech.listening
                ? t.placeholderListening
                : mode === "support"
                  ? t.placeholderSupport
                  : t.placeholder
            }
            disabled={loading}
            autoComplete="off"
            maxLength={2000}
            autoFocus
          />
          {speech.supported && (
            <button
              type="button"
              className={`mic${speech.listening ? " listening" : ""}`}
              onClick={toggleVoiceInput}
              disabled={loading}
              aria-label={speech.listening ? t.micStop : t.micStart}
              aria-pressed={speech.listening}
              title={speech.listening ? t.micStop : t.micStart}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                />
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="button-primary"
            disabled={loading || !input.trim()}
          >
            {t.send}
          </button>
        </div>
      </form>
      {speech.error && (
        <p className="voice-error" role="alert">
          {t.speechErrors[speech.error]}
        </p>
      )}
    </main>
  );
}
