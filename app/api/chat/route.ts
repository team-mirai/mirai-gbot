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
    "挨拶やこのチャットボットの使い方についての質問には、短く応じたうえで行政相談を促してください。行政と関係があるか判断に迷う場合は、行政に関わる部分について答えてください。",
    `今日は ${today}（日本時間）です。`,
    "これはチャットです。人と会話するように、短く自然に返してください。",
    "- 1回の返答は基本 2〜4 文（日本語なら 200 字程度まで）。まず結論を一言で。",
    "- 見出し（#）、表、長い箇条書き、太字の多用はしない。箇条書きが必要なときも 3 項目まで。",
    "- 全部を一度に説明しようとせず、要点だけ答えて、必要なら「〇〇についても詳しく話しましょうか？」と続きを聞く。",
    "- ユーザーが詳しい説明・一覧・手順などを明示的に求めたときだけ、長めに答えてよい。",
    WEB_SEARCH
      ? "Web 検索結果が与えられた場合、最新の事実や数値はそれを根拠に答えてください。出典は本文中に [サイト名](URL) の形で 1〜2 個だけ添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
      : "",
    // 情報源の信頼性（Issue #17）
    WEB_SEARCH
      ? "情報源は公的機関（省庁・自治体などの go.jp / lg.jp ドメイン、e-Gov 法令検索、裁判所など）のページを最優先で根拠・出典にしてください。民間サイト・まとめ記事・個人ブログは、公的機関の情報で裏付けられない限り根拠にしないでください。公的機関の情報源が見つからなかった場合は、「公的機関の情報で確認できませんでした」と明示してください。"
      : "",
    `年度・税制改正・制度改正・金額・期限など時点によって変わる内容は、今日の日付（${today}）を基準に最新の年度の情報を優先し、「令和〇年度時点」「〇年〇月時点」のように情報の時点を明示してください。検索結果が古い年度の情報しかない場合や、改正があった可能性がある場合は、その旨を一言注意書きしてください。`,
    "制度・手続き・金額・期限などについて答えたときは、回答の最後に「※最終的な確認はお住まいの自治体や担当窓口でお願いします。」と1行添えてください（挨拶やスコープ外の返答には不要です）。",
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

// 公的機関のドメインか（省庁・e-Gov などの go.jp、自治体の lg.jp、
// lg.jp 以外の自治体ドメイン例: city.chiba.jp / pref.xxx.jp）
const OFFICIAL_HOSTS = [
  /(^|\.)(go|lg)\.jp$/,
  /(^|\.)(pref|city|town|vill)\.[a-z0-9-]+(\.[a-z0-9-]+)?\.jp$/,
];
function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

// 出典の末尾表示: 公的機関を先頭に並べ、公的機関が 1 件もなければ注意書きを付ける
function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return "";
  const official = citations.filter((c) => isOfficialSource(c.url));
  const others = citations.filter((c) => !isOfficialSource(c.url));
  const list = [...official, ...others]
    .slice(0, 3)
    .map((c) => `[${linkLabel(c)}](${c.url})`)
    .join(" · ");
  const note =
    official.length === 0
      ? "\n\n※公的機関（省庁・自治体など）の情報源は見つかりませんでした。内容は公式サイトや担当窓口でご確認ください。"
      : "";
  return `\n\n出典: ${list}${note}`;
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

        // 検索で参照したページを末尾に出典としてコンパクトに付ける（公的機関のページを優先）
        const footer = formatCitations([...citations.values()]);
        if (footer) controller.enqueue(encoder.encode(footer));
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
