"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { useSpeechRecognition } from "./useSpeechRecognition";
import {
  type Conversation,
  type Message,
  type Mode,
  deleteAllConversations,
  deleteConversation,
  loadConversations,
  loadCurrentId,
  newConversationId,
  saveConversation,
  saveCurrentId,
} from "./chatHistory";

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
  // 会話履歴（ブラウザの localStorage にのみ保存。サーバーには保存しない）
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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

  // 初回表示時に保存済みの会話を読み込み、直前の会話を復元する
  // （サーバーレンダリング結果と食い違わないよう、マウント後に読む）
  useEffect(() => {
    const list = loadConversations();
    const current = list.find((c) => c.id === loadCurrentId());
    setConversations(list);
    if (current) {
      setConversationId(current.id);
      setMode(current.mode);
      setMessages(current.messages);
    } else {
      setConversationId(newConversationId());
    }
  }, []);

  // 返答が完了するたびに会話を保存する（ストリーミング中は書き込まない）
  useEffect(() => {
    if (!conversationId || loading) return;
    setConversations(saveConversation(conversationId, mode, messages));
    saveCurrentId(messages.length > 0 ? conversationId : null);
  }, [conversationId, mode, messages, loading]);

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
    const id = newConversationId();
    setConversationId(id);
    setMode("support");
    send(SUPPORT_START, [], "support", id);
  }

  function resetChat() {
    if (loading) return;
    setConversationId(newConversationId());
    setMode("chat");
    setMessages([]);
    setShowHistory(false);
  }

  function openConversation(conv: Conversation) {
    if (loading) return;
    speech.cancel();
    setConversationId(conv.id);
    setMode(conv.mode);
    setMessages(conv.messages);
    setInput("");
    setShowHistory(false);
  }

  function removeConversation(conv: Conversation) {
    if (loading) return;
    if (!window.confirm(`「${conv.title}」を削除しますか？`)) return;
    setConversations(deleteConversation(conv.id));
    if (conv.id === conversationId) {
      setConversationId(newConversationId());
      setMode("chat");
      setMessages([]);
    }
  }

  function removeAllConversations() {
    if (loading) return;
    if (!window.confirm("保存されているすべての会話を削除しますか？この操作は取り消せません。")) {
      return;
    }
    deleteAllConversations();
    setConversations([]);
    setConversationId(newConversationId());
    setMode("chat");
    setMessages([]);
    setShowHistory(false);
  }

  async function send(
    rawText: string,
    prev: Message[] = messages,
    currentMode: Mode = mode,
    id: string = conversationId,
  ) {
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
    setShowHistory(false);
    // 返答の途中で再読み込みされても質問は残るよう、先に保存しておく
    if (id) {
      setConversations(saveConversation(id, currentMode, history));
      saveCurrentId(id);
    }

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
            {(conversations.length > 0 || showHistory) && (
              <button
                type="button"
                className="header-button"
                onClick={() => setShowHistory((v) => !v)}
                disabled={loading}
                aria-expanded={showHistory}
                aria-controls="history-panel"
              >
                {showHistory ? "会話に戻る" : "会話履歴"}
              </button>
            )}
            {(messages.length > 0 || showHistory) && (
              <button
                type="button"
                className="header-button"
                onClick={resetChat}
                disabled={loading}
              >
                新しい会話
              </button>
            )}
          </div>
        </div>
      </header>

      {showHistory ? (
        <section id="history-panel" className="messages" aria-labelledby="history-title">
          <div className="messages-inner">
            <h2 id="history-title" className="history-title">
              会話履歴
            </h2>
            <p className="history-note">
              会話はこの端末のブラウザ内にのみ保存され、サーバーには保存されません。共用の端末では使い終わったら削除してください。
            </p>
            {conversations.length === 0 ? (
              <p className="history-empty">保存されている会話はありません。</p>
            ) : (
              <>
                <ul className="history-list">
                  {conversations.map((c) => (
                    <li
                      key={c.id}
                      className={`history-item${c.id === conversationId ? " current" : ""}`}
                    >
                      <button
                        type="button"
                        className="history-open"
                        onClick={() => openConversation(c)}
                        aria-current={c.id === conversationId ? "true" : undefined}
                      >
                        <span className="history-item-title">
                          {c.mode === "support" && (
                            <span className="mode-badge">支援制度を探す</span>
                          )}
                          {c.title}
                        </span>
                        <span className="history-item-date">
                          {new Date(c.updatedAt).toLocaleString("ja-JP", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="history-delete"
                        onClick={() => removeConversation(c)}
                        aria-label={`「${c.title}」を削除`}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="history-delete-all"
                  onClick={removeAllConversations}
                >
                  すべての会話を削除
                </button>
              </>
            )}
          </div>
        </section>
      ) : (
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
                <button type="button" className="mode-button" onClick={startSupport}>
                  使える支援制度を探す
                </button>
                <p className="note">
                  いくつかの質問にお答えいただくと、利用できそうな給付・手当・減免・相談窓口をご案内します。
                </p>
                <p className="note">
                  会話はこの端末のブラウザ内にのみ保存され、サーバーには保存されません。
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
      )}

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
      {speech.error && (
        <p className="voice-error" role="alert">
          {speech.error}
        </p>
      )}
    </main>
  );
}
