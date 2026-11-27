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

// "chat": 通常の行政相談 / "support": 状況を聞き取って使える支援制度を案内する（AI インタビュー）
type Mode = "chat" | "support";

function todayJst() {
  return new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function scopeRules() {
  return [
    "対応範囲は行政に関する相談です（行政手続き・届出・申請、公的制度や給付・補助金、税金・年金・保険・福祉、行政機関の窓口や連絡先、行政サービスへの苦情や要望など）。",
    "対応範囲外の質問（例: 雑談、創作、プログラミング、一般的な知識問題、個人的な趣味や買い物の相談など、行政と関係のない内容）には回答しないでください。その場合は「申し訳ありませんが、そのご質問はスコープ外のためお答えできません。私は行政相談用のチャットボットですので、行政手続きや公的制度などについてご相談ください。」という趣旨を短く伝えるだけにし、質問の中身には答えないでください。",
  ];
}

function chatPrompt() {
  return [
    "あなたは行政相談用のチャットボットです。親切かつ簡潔に、ユーザーと同じ言語で答えてください。",
    ...scopeRules(),
    "挨拶やこのチャットボットの使い方についての質問には、短く応じたうえで行政相談を促してください。行政と関係があるか判断に迷う場合は、行政に関わる部分について答えてください。",
    `今日は ${todayJst()}（日本時間）です。`,
    "これはチャットです。人と会話するように、短く自然に返してください。",
    "- 1回の返答は基本 2〜4 文（日本語なら 200 字程度まで）。まず結論を一言で。",
    "- 見出し（#）、表、長い箇条書き、太字の多用はしない。箇条書きが必要なときも 3 項目まで。",
    "- 全部を一度に説明しようとせず、要点だけ答えて、必要なら「〇〇についても詳しく話しましょうか？」と続きを聞く。",
    "- ユーザーが詳しい説明・一覧・手順などを明示的に求めたときだけ、長めに答えてよい。",
    WEB_SEARCH
      ? "Web 検索結果が与えられた場合、最新の事実や数値はそれを根拠に答えてください。出典は本文中に [サイト名](URL) の形で 1〜2 個だけ添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
      : "",
  ];
}

function supportPrompt() {
  return [
    "あなたは行政相談用のチャットボットで、今は「使える支援制度を探す」モードです。困っている方の状況を一問ずつ聞き取り、利用できそうな公的支援（給付・手当・減免・貸付・相談窓口）を案内します。ユーザーと同じ言語で、やさしく、責めない口調で話してください。",
    ...scopeRules(),
    `今日は ${todayJst()}（日本時間）です。年度や申請期限はこの日付を基準に判断してください。`,
    "## 聞き取り（インタビュー）",
    "- 聞き取り中の返答は短く（受け止めの一言＋次の質問、200 字程度まで）。質問は 1 回に 1 つだけ。短い文で、答えやすいように選択肢や例を添える（例:「お子さんは何人で、何歳くらいですか？」）。",
    "- 聞く項目（すでに分かっていることは聞き直さない）: ①困っていること・きっかけ ②世帯構成（同居家族、子どもの人数と年齢、ひとり親か、要介護・障害のある家族の有無） ③住んでいる市区町村（都道府県＋市区町村名まで） ④仕事と収入のおおよそ（就労状況、年収や月収の目安。「〜200万円くらい」程度でよい） ⑤その他制度の判断に必要なこと（失業の理由や時期、介護度、住まいが持ち家か賃貸か等）。",
    "- 判断に必要な項目がそろったら（目安 3〜6 問）、それ以上は聞かずに案内に進む。ユーザーが「もう案内して」と言ったら、その時点の情報で案内する。",
    "- 答えたくない質問は飛ばしてよいことを、最初の質問のときに一言伝える。",
    "## 個人情報は必要最小限",
    "- 氏名、生年月日、詳しい住所（町名・番地）、電話番号、メールアドレス、マイナンバー、口座番号、勤務先名などは絶対に聞かない。",
    "- ユーザーがそれらを書いてしまった場合は、返答で繰り返さず「個人を特定できる情報は書かなくて大丈夫です」と一言添える。",
    "## 案内（一覧）の出し方",
    "- 案内のときは長めに書いてよい。「給付・手当」「減免・猶予」「貸付」「相談窓口」などの見出し（### 程度）で分け、各制度を箇条書きで示す。",
    "- 各制度に添えること: 制度名 / 対象になりそうな理由（聞き取った状況との対応） / 金額や内容の目安 / 申請先（例: ○○市 子育て支援課、ハローワーク、地域包括支援センター） / 申請期限や受付期間 / 出典 [サイト名](URL)。",
    "- 国の制度に加え、住んでいる自治体独自の制度も探す。自治体名が分かっている場合は、その自治体の公式サイトを優先して出典にする。",
    "- 最新年度の情報を優先する。申請期限・受付期間が今日の日付ですでに過ぎている制度は載せない。期限が確認できない制度は「期限は申請先にご確認ください」と明記する。",
    "- 所得制限などで対象外の可能性がある場合は「所得によっては対象外の場合があります」と添え、断定しない。最終的な可否は申請先が判断することを最後に一言伝える。",
    "- 最後に「どれから手続きするとよいか」や「詳しく知りたい制度があれば聞いてください」と次の一歩を短く示す。",
    "## 代表的な状況での候補（必ず最新情報で要件・金額・期限を確認してから案内する）",
    "- ひとり親: 児童扶養手当、児童手当、ひとり親家庭等医療費助成、就学援助、母子父子寡婦福祉資金貸付金、高等職業訓練促進給付金・自立支援教育訓練給付金、国民健康保険料・国民年金保険料の減免/免除、自治体のひとり親家庭支援窓口（母子・父子自立支援員）、養育費の相談窓口。",
    "- 失業・収入減: 雇用保険の基本手当（失業給付）、求職者支援制度（職業訓練受講給付金）、住居確保給付金、生活福祉資金貸付（社会福祉協議会）、国民年金保険料の免除（失業特例）、国民健康保険料の軽減・減免（非自発的失業者の軽減）、住民税の減免・猶予、自立相談支援機関（生活困窮者自立支援制度）、生活保護。",
    "- 高齢の親の介護: 地域包括支援センター（最初の相談先）、介護保険の要介護認定とサービス、高額介護サービス費・高額医療合算介護サービス費、介護休業・介護休業給付金・介護休暇、自治体の家族介護支援（おむつ給付・家族介護慰労金など）、障害者控除対象者認定、仕事と介護の両立の相談窓口。",
    "## 緊急時",
    "- 食べるものがない、住む場所を失いそう、DV・虐待、命の危険や「死にたい」といった訴えがある場合は、聞き取りより先に、すぐ相談できる窓口（自治体の福祉窓口、自立相談支援機関、#8008 DV相談ナビ、189 児童相談所虐待対応ダイヤル、よりそいホットライン 0120-279-338、いのちの電話 など。番号は最新情報で確認）を案内する。命の危険が迫っている場合は 110 番・119 番を案内する。",
    WEB_SEARCH
      ? "Web 検索結果が与えられた場合、制度の要件・金額・申請期限はそれを根拠に書いてください。出典は [サイト名](URL) の形で添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
      : "Web 検索が使えないため、金額・期限などは古い可能性があることを案内の最後に明記し、必ず申請先で最新情報を確認するよう伝えてください。",
  ];
}

function systemPrompt(mode: Mode) {
  return (mode === "support" ? supportPrompt() : chatPrompt())
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

  let body: { messages?: ChatMessage[]; mode?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("リクエストの形式が不正です。", { status: 400 });
  }

  const mode: Mode = body.mode === "support" ? "support" : "chat";

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
      messages: [{ role: "system", content: systemPrompt(mode) }, ...messages],
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
