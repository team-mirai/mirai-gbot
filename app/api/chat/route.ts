export const runtime = "nodejs";
export const maxDuration = 60;

// OpenRouter 経由で Claude を呼び出す（OpenAI 互換の Chat Completions API）
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const BASE_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-5.5";
// Web 検索: モデル名に ":online" を付けると OpenRouter が検索結果を付けて呼び出す。
// OPENROUTER_WEB_SEARCH=false で無効化できる（既定は有効）。
const WEB_SEARCH = process.env.OPENROUTER_WEB_SEARCH !== "false";
const MODEL =
  WEB_SEARCH && !BASE_MODEL.endsWith(":online") ? `${BASE_MODEL}:online` : BASE_MODEL;

// ボット自身についての情報。「あなたは誰？」「無料？」「何ができる？」などにはこれだけを根拠に答えさせる。
const BOT_PROFILE = [
  "あなた自身について（自己紹介情報）:",
  "- 名前: MIRAI G Bot（みらい G ボット）。「G ボット」「Gボット」「ガボット」などと呼ばれた場合も、あなた自身のことを指しています。",
  "- 目的: 行政手続きや公的制度についての疑問に、AI がチャットで手軽に答える行政相談用のチャットボットです。",
  "- 運営者: チームみらい（オープンソースとして GitHub の team-mirai/mirai-gbot で開発・公開しています）。",
  "- 利用料: 利用者は無料で使えます（会員登録も不要です）。",
  "- できること: 行政手続き・届出・申請の方法や期限、給付・補助金などの公的制度、税金・年金・保険・福祉、窓口の案内などについての質問に答えます。必要に応じて Web 検索で最新情報を調べ、出典を示します。",
  "- できないこと・注意: 個別の申請の代行や受付、個人情報を使った判定はできません。回答は AI によるもので誤りを含むことがあるため、最終的な判断は公式サイトや窓口で確認するよう案内してください。特定の政党や候補者への投票を勧めることはしません。",
  "あなたの名前・目的・運営者・利用料・できることを聞かれたら、上の情報だけをもとに一貫して答えてください。Web 検索結果に同名・類似名のもの（舞曲の「ガボット」や他社のサービスなど）が出てきても、それをあなた自身の説明として使わないでください。上の情報にないことは推測で答えず、わからないと伝えてください。",
].join("\n");

function systemPrompt() {
  const today = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return [
    "あなたは行政相談用のチャットボットです。親切かつ簡潔に、ユーザーと同じ言語で答えてください。",
    "対応範囲は行政に関する相談です（行政手続き・届出・申請、公的制度や給付・補助金、税金・年金・保険・福祉、行政機関の窓口や連絡先、行政サービスへの苦情や要望など）。",
    "対応範囲外の質問（例: 雑談、創作、プログラミング、一般的な知識問題、個人的な趣味や買い物の相談など、行政と関係のない内容）には回答しないでください。その場合は「申し訳ありませんが、そのご質問はスコープ外のためお答えできません。私は行政相談用のチャットボットですので、行政手続きや公的制度などについてご相談ください。」という趣旨を短く伝えるだけにし、質問の中身には答えないでください。",
    "挨拶や、このチャットボット自身（名前・目的・運営者・利用料・できること・使い方）についての質問は対応範囲内です。下の自己紹介情報をもとに短く答えたうえで行政相談を促してください。行政と関係があるか判断に迷う場合は、行政に関わる部分について答えてください。",
    BOT_PROFILE,
    `今日は ${today}（日本時間）です。`,
    "これはチャットです。人と会話するように、短く自然に返してください。",
    "- 1回の返答は基本 2〜4 文（日本語なら 200 字程度まで）。まず結論を一言で。",
    "- 見出し（#）、表、長い箇条書き、太字の多用はしない。箇条書きが必要なときも 3 項目まで。",
    "- 全部を一度に説明しようとせず、要点だけ答えて、必要なら「〇〇についても詳しく話しましょうか？」と続きを聞く。",
    "- ユーザーが詳しい説明・一覧・手順などを明示的に求めたときだけ、長めに答えてよい。",
    WEB_SEARCH
      ? "Web 検索結果が与えられた場合、最新の事実や数値はそれを根拠に答えてください。出典は本文中に [サイト名](URL) の形で 1〜2 個だけ添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

type Citation = { url: string; title?: string };

// 出典リンクの表示名: タイトル（長ければ短縮）→ なければドメイン
function linkLabel(c: Citation): string {
  const clean = (c.title ?? "").replace(/[\[\]\n]/g, " ").trim();
  if (clean) return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
  try {
    return new URL(c.url).hostname.replace(/^www\./, "");
  } catch {
    return c.url;
  }
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY が設定されていません。", {
      status: 500,
    });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("リクエストの形式が不正です。", { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return new Response("最後のメッセージはユーザーの発言である必要があります。", {
      status: 400,
    });
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "mirai-gbot",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      max_tokens: 4000,
      reasoning: { effort: "low" },
      messages: [{ role: "system", content: systemPrompt() }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenRouter error", upstream.status, detail);
    return new Response(`OpenRouter エラー (${upstream.status}): ${detail}`, {
      status: 502,
    });
  }

  // OpenRouter の SSE を読み、本文テキストだけをクライアントへ流す
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      const citations = new Map<string, Citation>();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue; // コメント行(: OPENROUTER PROCESSING)などは無視
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;

            let chunk: {
              choices?: {
                delta?: {
                  content?: string;
                  annotations?: {
                    type?: string;
                    url_citation?: { url?: string; title?: string };
                  }[];
                };
              }[];
              error?: { message?: string };
            };
            try {
              chunk = JSON.parse(data);
            } catch {
              continue;
            }

            if (chunk.error) {
              controller.enqueue(
                encoder.encode(`\n\n[エラー: ${chunk.error.message ?? "不明"}]`),
              );
              continue;
            }
            const delta = chunk.choices?.[0]?.delta;
            for (const a of delta?.annotations ?? []) {
              const url = a.url_citation?.url;
              if (a.type === "url_citation" && url && !citations.has(url)) {
                citations.set(url, { url, title: a.url_citation?.title });
              }
            }
            if (delta?.content) controller.enqueue(encoder.encode(delta.content));
          }
        }

        // 検索で参照したページを末尾に出典としてコンパクトに付ける
        if (citations.size > 0) {
          const list = [...citations.values()]
            .slice(0, 3)
            .map((c) => `[${linkLabel(c)}](${c.url})`)
            .join(" · ");
          controller.enqueue(encoder.encode(`\n\n出典: ${list}`));
        }
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode("\n\n[エラーが発生しました。]"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
