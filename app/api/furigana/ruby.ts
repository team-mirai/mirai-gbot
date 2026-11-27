// 形態素解析の結果（表層形＋読み）から、ふりがな付きの区切りを作る（外部依存なし）。

// 文字列のまま: ふりがな不要 / [漢字, よみ]: ふりがなを付ける
export type RubySegment = string | [string, string];

// 漢字（々・〆・ヶ も漢字扱い。例: 人々・霞ヶ関）
const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/;
const KANJI_RUN = /([㐀-䶿一-鿿豈-﫿々〆ヶ]+)/;

export function hasKanji(s: string): boolean {
  return KANJI.test(s);
}

// カタカナをひらがなに（ふりがなはひらがなで表示する）
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 1 語分の表層形と読み（カタカナ）から、送り仮名を除いて漢字部分だけにふりがなを振る。
// 例: 申し込み / モウシコミ → [申,もう] し [込,こ] み
export function rubyForToken(surface: string, reading: string | undefined): RubySegment[] {
  if (!hasKanji(surface) || !reading || reading === "*") return [surface];
  const kana = toHiragana(reading);
  const parts = surface.split(KANJI_RUN).filter(Boolean);
  // 漢字の並びは読みの任意の部分、かな等はそのまま一致させて読みを割り当てる
  const pattern = parts
    .map((p) => (hasKanji(p) ? "(.+?)" : escapeRegExp(toHiragana(p))))
    .join("");
  const m = kana.match(new RegExp(`^${pattern}$`));
  if (!m) return [[surface, kana]];
  let g = 1;
  return parts.map((p) => (hasKanji(p) ? [p, m[g++]] : p));
}

// 隣り合う文字列の区切りはまとめて、返すデータを小さくする
export function mergeSegments(segments: RubySegment[]): RubySegment[] {
  const out: RubySegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (typeof s === "string" && typeof last === "string") out[out.length - 1] = last + s;
    else out.push(s);
  }
  return out;
}
