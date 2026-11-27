"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { GuideDialog } from "./GuideDialog";
import { Markdown } from "./Markdown";
import { useSpeechRecognition } from "./useSpeechRecognition";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };
// "chat": 通常の行政相談 / "support": 使える支援制度を探す（AI インタビュー）
type Mode = "chat" | "support";

const SUPPORT_START = "使える支援制度を探したいです。";

const EXAMPLE_QUESTIONS = [
  "住民票の取り方を教えてください",
  "マイナンバーカードをなくしたときはどうすればいいですか？",
  "引っ越しのときに必要な手続きを教えてください",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLDialogElement>(null);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  // 支援制度探しモードを新しい会話として始める（それまでの相談内容は送らない）
  function startSupport() {
    if (loading) return;
    setMode("support");
    send(SUPPORT_START, [], "support");
  }

  function openGuide() {
    guideRef.current?.showModal();
  }

  function closeGuide() {
    guideRef.current?.close();
  }

  // 「できること」の質問例を入力欄に入れる（送信は利用者が行う）
  function pickExample(question: string) {
    closeGuide();
    if (loading) return;
    setInput(question);
    inputRef.current?.focus();
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
            <p className="header-description">
              行政手続きや公的制度についての疑問に答える、行政相談用のチャットボットです。
            </p>
          )}
          <div className="header-actions">
            <button type="button" className="header-button" onClick={openGuide}>
              できること
            </button>
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
        </div>
      </header>

      <section className="messages" aria-label="会話">
        <div className="messages-inner" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty">
              <p>行政手続きや公的制度について、お気軽にご相談ください。</p>
              <p>
                マイナンバー・氏名・住所・電話番号などの個人情報は入力しないでください。
              </p>
              <p className="empty-sub">例えば、こんな質問ができます。</p>
              <div className="examples">
                {EXAMPLE_QUESTIONS.map((q) => (
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
              <button type="button" className="link-button" onClick={openGuide}>
                できること・使い方の一覧を見る
              </button>
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
              {m.role === "assistant" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src="/bot-avatar.png" alt="" width={40} height={40} />
              )}
              <div className="message-body">
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
            ref={inputRef}
            className="text-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              speech.listening
                ? "お話しください…"
                : mode === "support"
                  ? "状況を入力（個人情報は不要です）"
                  : "メッセージを入力"
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
          <button
            type="submit"
            className="button-primary"
            disabled={loading || !input.trim()}
          >
            送信
          </button>
        </div>
      </form>
      <GuideDialog ref={guideRef} onClose={closeGuide} onPickExample={pickExample} />
      {speech.error && (
        <p className="voice-error" role="alert">
          {speech.error}
        </p>
      )}
    </main>
  );
}
