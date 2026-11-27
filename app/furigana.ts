// ふりがな表示用のクライアント側ヘルパー。
// /api/furigana が返す区切りを、Markdown 本文に埋め込める目印付きの文字列に変換する。
// 目印には私用領域の文字（U+E000〜U+E002）を使い、Markdown の記法と衝突しないようにする。
//   漢字かんじ → <ruby>漢字<rt>かんじ</rt></ruby>

export const RUBY_OPEN = "";
export const RUBY_SEP = "";
export const RUBY_CLOSE = "";

const MARKERS = /[-]/g;
const RUBY_MARKUP = /([^-]*)[^-]*/g;

export type RubySegment = string | [string, string];

export function annotate(segments: RubySegment[]): string {
  return segments
    .map((s) =>
      typeof s === "string"
        ? s.replace(MARKERS, "")
        : `${RUBY_OPEN}${s[0].replace(MARKERS, "")}${RUBY_SEP}${s[1].replace(MARKERS, "")}${RUBY_CLOSE}`,
    )
    .join("");
}

// ふりがなの目印を取り除いて元の文字列に戻す（コードや URL の中など、ふりがなを出さない所で使う）
export function stripRuby(text: string): string {
  return text.replace(RUBY_MARKUP, "$1").replace(MARKERS, "");
}

// 回答テキストにふりがなを付けた文字列を取得する。失敗した場合は null。
export async function fetchFurigana(text: string): Promise<string | null> {
  try {
    const res = await fetch("/api/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: stripRuby(text) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { segments?: unknown };
    if (!Array.isArray(data.segments)) return null;
    const segments = data.segments.filter(
      (s): s is RubySegment =>
        typeof s === "string" ||
        (Array.isArray(s) && s.length === 2 && typeof s[0] === "string" && typeof s[1] === "string"),
    );
    const annotated = annotate(segments);
    // 解析で文字が欠けた場合などは元のテキストを優先する（内容を変えない）
    return stripRuby(annotated) === stripRuby(text) ? annotated : null;
  } catch {
    return null;
  }
}
