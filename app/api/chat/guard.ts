// /api/chat の不正利用対策（入力検証・レート制限・クロスサイト要求の拒否）

export type ChatMessage = { role: "user" | "assistant"; content: string };

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

// 入力サイズの上限（API キーの使い込み・巨大入力によるコスト増を防ぐ）
// 環境変数で変更できる（README の「不正利用・コスト対策」参照）
export const LIMITS = {
  bodyBytes: 64 * 1024, // リクエスト本文
  messages: Math.max(1, envInt("MAX_HISTORY_MESSAGES", 20)), // 会話履歴の件数（これより古いものは切り捨てる）
  messageChars: Math.max(1, envInt("MAX_INPUT_CHARS", 2000)), // 1 メッセージの文字数
  totalChars: Math.max(1, envInt("MAX_HISTORY_CHARS", 12000)), // 履歴全体の文字数
};

type Parsed = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

// クライアントから来た messages を検証する。
// content は文字列のみ許可（配列形式で画像・ファイル等を送り込まれるのを防ぐ）。
export function parseMessages(raw: unknown): Parsed {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { messages?: unknown }).messages)) {
    return { ok: false, error: "リクエストの形式が不正です。" };
  }
  const list = (raw as { messages: unknown[] }).messages;

  const messages: ChatMessage[] = [];
  for (const m of list) {
    if (!m || typeof m !== "object") return { ok: false, error: "リクエストの形式が不正です。" };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, error: "リクエストの形式が不正です。" };
    }
    if (!content.trim()) continue;
    if (role === "user" && content.length > LIMITS.messageChars) {
      return {
        ok: false,
        error: `メッセージが長すぎます（${LIMITS.messageChars} 文字以内にしてください）。`,
      };
    }
    // アシスタントの過去の返答は長くなりうるので切り詰めて受け入れる
    messages.push({ role, content: content.slice(0, LIMITS.messageChars * 2) });
  }

  // 古い履歴から切り捨てて件数・総文字数を上限内に収める
  let recent = messages.slice(-LIMITS.messages);
  let total = recent.reduce((n, m) => n + m.content.length, 0);
  while (recent.length > 1 && total > LIMITS.totalChars) {
    total -= recent[0].content.length;
    recent = recent.slice(1);
  }
  // 先頭はユーザー発言から始める
  while (recent.length > 0 && recent[0].role !== "user") recent = recent.slice(1);

  if (recent.length === 0 || recent[recent.length - 1].role !== "user") {
    return { ok: false, error: "最後のメッセージはユーザーの発言である必要があります。" };
  }
  return { ok: true, messages: recent };
}

// 他サイトのページから訪問者のブラウザ経由で叩かれるのを防ぐ。
// （curl 等は Origin を偽装できるので、これ単体では不正利用対策にならない。レート制限と併用）
export function isCrossSite(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function clientIp(req: Request): string {
  // Vercel は x-forwarded-for の先頭に実クライアント IP を入れる
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// IP ごとの簡易レート制限（固定ウィンドウ / 1 分あたり・1 日あたり）。
// サーバーレスではインスタンスごとのメモリなので完全ではない（上限は目安）。
// 本番では Vercel Firewall のレート制限ルールや OpenRouter キーの利用上限も併用すること。
const PER_MINUTE = envInt("RATE_LIMIT_PER_MINUTE", 10); // 0 で無効
const PER_DAY = envInt("RATE_LIMIT_PER_DAY", 100); // 0 で無効
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_KEYS = 10_000;

type Window = { count: number; reset: number };
const hits = new Map<string, { minute: Window; day: Window }>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; message: string };

export function rateLimit(key: string, now = Date.now()): RateLimitResult {
  if (!(PER_MINUTE > 0) && !(PER_DAY > 0)) return { ok: true };
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (v.day.reset <= now) hits.delete(k);
    // それでも多すぎる場合は古いものから削除（メモリ枯渇対策）
    for (const k of hits.keys()) {
      if (hits.size <= MAX_KEYS) break;
      hits.delete(k);
    }
  }

  let entry = hits.get(key);
  if (!entry) {
    entry = {
      minute: { count: 0, reset: now + MINUTE_MS },
      day: { count: 0, reset: now + DAY_MS },
    };
    hits.set(key, entry);
  }
  if (entry.minute.reset <= now) entry.minute = { count: 0, reset: now + MINUTE_MS };
  if (entry.day.reset <= now) entry.day = { count: 0, reset: now + DAY_MS };

  if (PER_DAY > 0 && entry.day.count >= PER_DAY) {
    return {
      ok: false,
      retryAfter: Math.ceil((entry.day.reset - now) / 1000),
      message:
        "本日の利用上限に達しました。申し訳ありませんが、時間をおいて明日以降に再度お試しください。",
    };
  }
  if (PER_MINUTE > 0 && entry.minute.count >= PER_MINUTE) {
    const sec = Math.ceil((entry.minute.reset - now) / 1000);
    return {
      ok: false,
      retryAfter: sec,
      message: `短時間に多くのリクエストがありました。${sec} 秒ほど待ってから再度お試しください。`,
    };
  }
  entry.minute.count++;
  entry.day.count++;
  return { ok: true };
}

// 出典 URL は http(s) のみ・Markdown を壊す文字を含まないものだけ出す
export function safeCitationUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.href.replace(/\(/g, "%28").replace(/\)/g, "%29");
  } catch {
    return null;
  }
}
