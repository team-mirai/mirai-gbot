import path from "node:path";
import kuromoji from "kuromoji";
import { isCrossSite } from "../chat/guard";
import { type RubySegment, mergeSegments, rubyForToken } from "./ruby";

// 回答の漢字にふりがなを付けるための読みを返す。
// 読みは辞書ベースの形態素解析（kuromoji + IPADIC）で付ける。LLM は呼ばないので従量課金は発生しない。
// 辞書（約 18MB）をブラウザに配らずに済むよう、解析はサーバー側で行う。

export const runtime = "nodejs";

// 回答 1 件分のテキストの上限（チャットの回答はこれより十分短い）
const MAX_CHARS = 20_000;
const MAX_BODY_BYTES = 256 * 1024;

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
let tokenizerPromise: Promise<Tokenizer> | null = null;

// 辞書の読み込みは重い（初回のみ数百 ms〜1 秒程度）ので、インスタンス内で使い回す
function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    const dicPath = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
    tokenizerPromise = new Promise<Tokenizer>((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
    });
    tokenizerPromise.catch(() => {
      tokenizerPromise = null; // 失敗したら次のリクエストで再試行する
    });
  }
  return tokenizerPromise;
}

function errorResponse(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: Request) {
  if (isCrossSite(req)) return errorResponse("許可されていない呼び出し元です。", 403);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return errorResponse("テキストが長すぎます。", 413);

  let text: unknown;
  try {
    text = (JSON.parse(raw) as { text?: unknown })?.text;
  } catch {
    return errorResponse("リクエストの形式が不正です。", 400);
  }
  if (typeof text !== "string") return errorResponse("リクエストの形式が不正です。", 400);
  if (text.length > MAX_CHARS) return errorResponse("テキストが長すぎます。", 413);

  let tokenizer: Tokenizer;
  try {
    tokenizer = await getTokenizer();
  } catch (err) {
    console.error("kuromoji の辞書を読み込めませんでした", err);
    return errorResponse("ふりがなを付けられませんでした。", 500);
  }

  const segments: RubySegment[] = tokenizer
    .tokenize(text)
    .flatMap((t) => rubyForToken(t.surface_form, t.reading));

  return Response.json(
    { segments: mergeSegments(segments) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
