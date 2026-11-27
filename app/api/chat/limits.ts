// /api/chat の不正利用・トークン消費攻撃への対策
// - IP 単位のレート制限（1 分あたり・1 日あたり）
// - 1 メッセージの入力長・会話履歴の長さの上限
//
// 注意: レート制限のカウンタはサーバーのメモリ上に持つため、Vercel のように
// 複数インスタンスで動く環境ではインスタンスごとのカウントになる（上限は目安）。
// 確実な上限は OpenRouter 側のクレジット上限で担保する（README 参照）。

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const LIMITS = {
  // IP あたりのリクエスト上限（0 で無効）
  perMinute: envInt("RATE_LIMIT_PER_MINUTE", 10),
  perDay: envInt("RATE_LIMIT_PER_DAY", 100),
  // 1 メッセージあたりの最大文字数（最新のユーザー発言がこれを超えたら拒否）
  maxInputChars: envInt("MAX_INPUT_CHARS", 1000),
  // モデルに送る会話履歴の最大件数・合計文字数（超えた分は古い方から切り捨て）
  maxHistoryMessages: envInt("MAX_HISTORY_MESSAGES", 20),
  maxHistoryChars: envInt("MAX_HISTORY_CHARS", 8000),
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

type Counter = { start: number; count: number };
type Entry = { minute: Counter; day: Counter };

const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 10_000;

// クライアント IP を推定する。Vercel では x-forwarded-for の先頭がクライアント IP。
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function prune(now: number) {
  for (const [key, e] of buckets) {
    if (now - e.day.start >= DAY) buckets.delete(key);
  }
  // それでも多すぎる場合は古いものから削除（メモリ枯渇対策）
  if (buckets.size > MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(key);
    }
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; message: string };

// 固定ウィンドウ方式でカウントする。上限内ならカウントを 1 増やして ok を返す。
export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) prune(now);

  let e = buckets.get(key);
  if (!e) {
    e = { minute: { start: now, count: 0 }, day: { start: now, count: 0 } };
    buckets.set(key, e);
  }
  if (now - e.minute.start >= MINUTE) e.minute = { start: now, count: 0 };
  if (now - e.day.start >= DAY) e.day = { start: now, count: 0 };

  if (LIMITS.perDay > 0 && e.day.count >= LIMITS.perDay) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((e.day.start + DAY - now) / 1000),
      message:
        "本日の利用上限に達しました。申し訳ありませんが、時間をおいて明日以降に再度お試しください。",
    };
  }
  if (LIMITS.perMinute > 0 && e.minute.count >= LIMITS.perMinute) {
    const sec = Math.ceil((e.minute.start + MINUTE - now) / 1000);
    return {
      ok: false,
      retryAfterSec: sec,
      message: `短時間に多くのリクエストがありました。${sec} 秒ほど待ってから再度お試しください。`,
    };
  }

  e.minute.count++;
  e.day.count++;
  return { ok: true };
}

// テスト用
export function resetRateLimit() {
  buckets.clear();
}

type ChatMessage = { role: "user" | "assistant"; content: string };

// 会話履歴を件数・合計文字数の上限内に収める（新しい方を優先して残す）。
// 先頭は必ずユーザー発言になるように調整する。
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (LIMITS.maxHistoryMessages > 0 && kept.length >= LIMITS.maxHistoryMessages) break;
    if (LIMITS.maxHistoryChars > 0 && kept.length > 0 && total + m.content.length > LIMITS.maxHistoryChars)
      break;
    kept.unshift(m);
    total += m.content.length;
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}
