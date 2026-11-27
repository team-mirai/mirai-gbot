"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
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
import { FuriganaContext, FuriganaText } from "./Furigana";

const FURIGANA_KEY = "mirai-gbot:furigana";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };
// "chat": 通常の行政相談 / "support": 使える支援制度を探す（AI インタビュー）
type Mode = "chat" | "support";

// 手動で選んだ表示言語を保存するキー
const LOCALE_STORAGE_KEY = "mirai-gbot-locale";

// 文字サイズ（html 要素の data-font-size 属性で切り替え。DADS の文字サイズは rem 指定なので追従する）
const FONT_SIZES = ["normal", "large", "xlarge"] as const;
type FontSize = (typeof FONT_SIZES)[number];

// 設定はブラウザに保存する（layout.tsx の初期化スクリプトと同じキー）
const FONT_SIZE_KEY = "mirai-gbot:font-size";
const EASY_JAPANESE_KEY = "mirai-gbot:easy-japanese";

function isFontSize(v: string | null): v is FontSize {
  return FONT_SIZES.some((f) => f === v);
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // プライベートモード等で保存できなくても動作は続ける
  }
}

const GREETINGS: [string, string][] = [
  ["こんにちは", "。"],
  ["Hello", "."],
  ["你好", "。"],
  ["안녕하세요", "."],
  ["Xin chào", "."],
  ["Olá", "."],
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greeting, setGreeting] = useState(0);
  const [mode, setMode] = useState<Mode>("chat");
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = MESSAGES[locale];
  const [furigana, setFurigana] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [easyJapanese, setEasyJapanese] = useState(false);
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
  const inChat = messages.length > 0;
  // 振り仮名・やさしい日本語は日本語表示のときだけ使う（中国語の漢字に日本語の読みを振らないため）
  const isJapanese = locale === "ja";
  const furiganaOn = furigana && isJapanese;
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

  useEffect(() => {
    if (inChat) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setGreeting((g) => (g + 1) % GREETINGS.length), 2600);
    return () => clearInterval(id);
  }, [inChat]);

  // 支援制度探しモードを新しい会話として始める（それまでの相談内容は送らない）
  function startSupport() {
    if (loading) return;
    setMode("support");
    send(t.supportStart, [], "support");
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
        body: JSON.stringify({
          messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
          mode: currentMode,
          locale,
          // やさしい日本語は日本語表示のときだけ有効
          easyJapanese: easyJapanese && locale === "ja",
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function reset() {
    if (loading) return;
    speech.cancel();
    setMode("chat");
    setMessages([]);
    setInput("");
    window.scrollTo({ top: 0 });
  }

  const brand = (
    <button type="button" className="brand" onClick={reset} aria-label={t.home}>
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
        <small>{t.tagline}</small>
      </span>
    </button>
  );

  // 表示言語の切り替え。トップとチャット画面のヘッダーに出す
  const localeSelect = (
    <>
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
    </>
  );

  const furiganaToggle = isJapanese && (
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
  );

  const withFurigana = (node: ReactNode) => (
    <FuriganaContext.Provider value={furiganaOn}>{node}</FuriganaContext.Provider>
  );

  // 表示設定（文字サイズ・やさしい日本語）。トップとチャット画面のヘッダー下に出す
  const settings = (
    <div className="settings">
      <div className="font-size" role="group" aria-label={t.fontSize}>
        <span className="settings-label" aria-hidden="true">
          {t.fontSize}
        </span>
        {FONT_SIZES.map((f) => (
          <button
            key={f}
            type="button"
            className="toggle"
            aria-pressed={fontSize === f}
            onClick={() => changeFontSize(f)}
          >
            {t.fontSizeLabels[f]}
          </button>
        ))}
      </div>
      {isJapanese && (
        <label className="easy-japanese">
          <input
            type="checkbox"
            checked={easyJapanese}
            onChange={(e) => changeEasyJapanese(e.target.checked)}
          />
          やさしい日本語
        </label>
      )}
    </div>
  );

  if (!inChat) {
    return withFurigana(
      <div className={`landing${furiganaOn ? " furigana-on" : ""}`}>
        <div className="landing-notice">
          <FuriganaText text={t.notice} />
        </div>

        <header className="header">
          <div className="header-inner">
            {brand}
            <div className="header-actions">
              {localeSelect}
              {furiganaToggle}
            </div>
          </div>
          {settings}
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
                <FuriganaText text={t.heroLead} />
              </p>

              <form className="ask" onSubmit={handleSubmit}>
                <label htmlFor="ask-input" className="visually-hidden">
                  {t.askLabel}
                </label>
                <input
                  id="ask-input"
                  className="text-field ask-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    speech.listening ? t.placeholderListening : t.askPlaceholder
                  }
                  autoFocus
                  autoComplete="off"
                  maxLength={2000}
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
                <button type="submit" className="button-primary ask-button" disabled={!input.trim()}>
                  {t.askButton}
                </button>
              </form>
              {speech.error && (
                <p className="voice-error ask-voice-error" role="alert">
                  {t.speechErrors[speech.error]}
                </p>
              )}

              <div className="suggestions">
                <p className="suggestions-label">
                  <FuriganaText text={t.suggestionsLabel} />
                </p>
                <ul>
                  {t.examples.map((s) => (
                    <li key={s}>
                      <button type="button" className="chip" onClick={() => send(s)}>
                        <FuriganaText text={s} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="support-cta">
                <button type="button" className="support-button" onClick={startSupport}>
                  <FuriganaText text={t.supportButton} />
                </button>
                <p>
                  <FuriganaText text={t.supportNote} />
                </p>
              </div>
            </div>
          </section>

          <section className="topics" aria-labelledby="topics-title">
            <div className="section-inner">
              <h2 id="topics-title">
                <FuriganaText text={t.topicsTitle} />
              </h2>
              <ul className="topic-grid">
                {t.topics.map((topic) => (
                  <li key={topic.title}>
                    <button type="button" className="topic" onClick={() => send(topic.q)}>
                      <span className="topic-title">
                        <FuriganaText text={topic.title} />
                      </span>
                      <span className="topic-desc">
                        <FuriganaText text={topic.desc} />
                      </span>
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
            <FuriganaText text={t.footerAvailable} />
            <br />
            <FuriganaText text={t.footerDisclaimer} />
          </div>
        </footer>
      </div>
    );
  }

  return withFurigana(
    <div className={`container${furiganaOn ? " furigana-on" : ""}`}>
      <header className="header">
        <div className="header-inner chat-header">
          {brand}
          {mode === "support" && <span className="mode-badge">{t.supportBadge}</span>}
          <div className="header-actions">
            {localeSelect}
            {furiganaToggle}
            <button type="button" className="button-secondary" onClick={reset} disabled={loading}>
              {t.reset}
            </button>
          </div>
        </div>
        {settings}
      </header>

      <main className="messages" aria-label={t.conversation}>
        <div className="messages-inner" aria-live="polite">
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
                  {m.role === "user" ? t.you : m.error ? t.error : "ジボジボ"}
                </span>
                {/* 生成中のメッセージは文字列が変わり続けるため、完了してから振り仮名を付ける */}
                <FuriganaContext.Provider
                  value={furiganaOn && !(loading && i === messages.length - 1)}
                >
                  <div className="bubble" role={m.error ? "alert" : undefined}>
                    {m.role === "assistant" && m.content && !m.error ? (
                      <Markdown text={m.content} />
                    ) : m.content ? (
                      <FuriganaText text={m.content} />
                    ) : loading ? (
                      <span className="typing">{t.typing}</span>
                    ) : (
                      ""
                    )}
                  </div>
                </FuriganaContext.Provider>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

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
          <button type="submit" className="button-primary" disabled={loading || !input.trim()}>
            {t.send}
          </button>
        </div>
      </form>
      {speech.error && (
        <p className="voice-error" role="alert">
          {t.speechErrors[speech.error]}
        </p>
      )}
    </div>
  );
}
