// 会話履歴をブラウザの localStorage に保存する。
// 行政相談は個人的な事情を含みうるため、サーバー側には一切保存しない。

export type Message = { role: "user" | "assistant"; content: string; error?: boolean };
// "chat": 通常の行政相談 / "support": 使える支援制度を探す（AI インタビュー）
export type Mode = "chat" | "support";

export type Conversation = {
  id: string;
  title: string;
  mode: Mode;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "mirai-gbot:conversations";
const CURRENT_KEY = "mirai-gbot:current-conversation";
// 端末の容量を圧迫しないよう、新しい順にこの件数だけ残す
const MAX_CONVERSATIONS = 50;

export function newConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isMessage(v: unknown): v is Message {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

function isConversation(v: unknown): v is Conversation {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    (c.mode === "chat" || c.mode === "support") &&
    typeof c.updatedAt === "number" &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage)
  );
}

/** 保存済みの会話を新しい順に返す。読めない場合は空配列。 */
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeConversations(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // 容量超過やプライベートモードなどで保存できない場合は何もしない
  }
}

export function loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function saveCurrentId(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // 保存できなくても動作は継続する
  }
}

function makeTitle(messages: Message[], mode: Mode): string {
  if (mode === "support") return "支援制度を探す";
  const first = messages.find((m) => m.role === "user")?.content.trim() ?? "";
  const oneLine = first.replace(/\s+/g, " ");
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine || "新しい会話";
}

/**
 * 会話を保存（上書き）し、更新後の一覧を返す。
 * エラー表示や空の返答は一時的なものなので保存しない。
 */
export function saveConversation(id: string, mode: Mode, messages: Message[]): Conversation[] {
  const kept = messages
    .filter((m) => !m.error && m.content)
    .map(({ role, content }) => ({ role, content }));
  const all = loadConversations();
  const existing = all.find((c) => c.id === id);
  // 開き直しただけで内容が変わっていない場合は並び順（更新日時）を変えない
  if (
    existing &&
    existing.mode === mode &&
    JSON.stringify(existing.messages) === JSON.stringify(kept)
  ) {
    return all;
  }
  const others = all.filter((c) => c.id !== id);
  if (kept.length === 0) {
    writeConversations(others);
    return others;
  }
  const conv: Conversation = {
    id,
    title: makeTitle(kept, mode),
    mode,
    messages: kept,
    updatedAt: Date.now(),
  };
  const list = [conv, ...others];
  writeConversations(list);
  return list.slice(0, MAX_CONVERSATIONS);
}

export function deleteConversation(id: string): Conversation[] {
  const list = loadConversations().filter((c) => c.id !== id);
  writeConversations(list);
  return list;
}

export function deleteAllConversations() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_KEY);
  } catch {
    // 何もしない
  }
}
