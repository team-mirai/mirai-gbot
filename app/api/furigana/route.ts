import path from "node:path";
import kuromoji from "kuromoji";
import { isCrossSite } from "../chat/guard";

export const runtime = "nodejs";

// 振り仮名の付与: kuromoji（形態素解析）で読みを求め、
// [表記, 読み?] の区切り列にして返す。読みは漢字部分にだけ付ける。
//   例: "食べる" → [["食", "た"], ["べる"]]

type Segment = [string] | [string, string];
type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let tokenizerPromise: Promise<Tokenizer> | null = null;

function getTokenizer(): Promise<Tokenizer> {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict") })
      .build((err, tokenizer) => {
        if (err) {
          tokenizerPromise = null;
          reject(err);
        } else resolve(tokenizer);
      });
  });
  return tokenizerPromise;
}

const KANJI = /[\p{Script=Han}々〆ヶ]/u;
const KANJI_RUN = /[\p{Script=Han}々〆ヶ]+/gu;

function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 送り仮名を読みから切り離し、漢字の連なりごとに読みを割り当てる
function splitOkurigana(surface: string, reading: string): Segment[] {
  const parts: { text: string; kanji: boolean }[] = [];
  let last = 0;
  for (const m of surface.matchAll(KANJI_RUN)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: surface.slice(last, start), kanji: false });
    parts.push({ text: m[0], kanji: true });
    last = start + m[0].length;
  }
  if (last < surface.length) parts.push({ text: surface.slice(last), kanji: false });

  const pattern = parts
    .map((p) => (p.kanji ? "(.+?)" : escapeRegExp(toHiragana(p.text))))
    .join("");
  const m = reading.match(new RegExp(`^${pattern}$`, "u"));
  if (!m) return [[surface, reading]];

  let g = 1;
  return parts.map((p) => (p.kanji ? [p.text, m[g++]] : [p.text]));
}

function annotate(tokenizer: Tokenizer, text: string): Segment[] {
  const out: Segment[] = [];
  const pushPlain = (s: string) => {
    const prev = out[out.length - 1];
    if (prev && prev.length === 1) prev[0] += s;
    else out.push([s]);
  };
  let prevSurface = "";
  for (const t of tokenizer.tokenize(text)) {
    const surface = t.surface_form;
    let reading = t.reading && t.reading !== "*" ? toHiragana(t.reading) : "";
    // 算用数字の後の「月」は辞書上「つき」になるため「がつ」に直す（例: 3月）
    if (surface === "月" && /^[0-9０-９]+$/.test(prevSurface)) reading = "がつ";
    prevSurface = surface;
    if (!KANJI.test(surface) || !reading || reading === surface) {
      pushPlain(surface);
      continue;
    }
    for (const seg of splitOkurigana(surface, reading)) {
      if (seg.length === 1) pushPlain(seg[0]);
      else out.push(seg);
    }
  }
  return out;
}

const MAX_TEXTS = 500;
const MAX_CHARS = 50_000;

export async function POST(req: Request) {
  if (isCrossSite(req)) {
    return new Response("許可されていない送信元です。", { status: 403 });
  }
  let texts: unknown;
  try {
    ({ texts } = await req.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (
    !Array.isArray(texts) ||
    texts.length > MAX_TEXTS ||
    !texts.every((t) => typeof t === "string") ||
    texts.reduce((n: number, t: string) => n + t.length, 0) > MAX_CHARS
  ) {
    return new Response("texts must be an array of strings", { status: 400 });
  }

  const tokenizer = await getTokenizer();
  return Response.json({
    results: (texts as string[]).map((t) => annotate(tokenizer, t)),
  });
}
