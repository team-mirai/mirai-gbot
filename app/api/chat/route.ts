import {
  type ChatMessage,
  LIMITS,
  clientIp,
  isCrossSite,
  parseMessages,
  rateLimit,
  safeCitationUrl,
} from "./guard";
import { BLOCKED_REPLY, BLOCKED_TOPIC_RULE, mentionsBlockedTopic } from "./blocked";

export const runtime = "nodejs";
export const maxDuration = 60;

// OpenRouter 経由で LLM を呼び出す（OpenAI 互換の Chat Completions API）
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const BASE_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-6-luna";
// Web 検索: OpenRouter の web プラグインで検索結果を付けて呼び出す。
// OPENROUTER_WEB_SEARCH=false で無効化できる（既定は有効）。
const WEB_SEARCH = process.env.OPENROUTER_WEB_SEARCH !== "false";
// 互換のため、モデル名に ":online" が付いていたら外す（検索はプラグインで明示的に設定する）
const MODEL = BASE_MODEL.replace(/:online$/, "");

// 検索対象にするドメイン（政府・自治体の公式ドメインのみ）。
// go.jp: 中央省庁など政府機関、lg.jp: 地方公共団体。
// 環境変数 SEARCH_ALLOWED_DOMAINS（カンマ区切り）で上書きできる。
const ALLOWED_DOMAINS = (process.env.SEARCH_ALLOWED_DOMAINS ?? "go.jp,lg.jp")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^\*\./, ""))
  .filter(Boolean);

// 検索エンジンにはドメイン自身とサブドメインの両方を指定する
const INCLUDE_DOMAINS = ALLOWED_DOMAINS.flatMap((d) => [d, `*.${d}`]);

// URL が許可ドメイン（またはそのサブドメイン）かどうか
function isAllowedUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

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
    "あなたは日本の行政相談ボットです。ユーザーが国や地域を指定していない質問（例:「AI 法案について教えて」「最低賃金はいくら？」）は、日本（国・自治体）の法律・制度・行政についての質問として答えてください。外国の法律や制度を主題にして答えないでください。比較などで外国に触れる場合は、日本の話を先に答えたうえで、外国の話であることを明記してください。",
    "自分で Web 検索のクエリを考える場合は、国が指定されていなければ「日本」や関係する省庁・自治体名をクエリに含め、日本の情報を優先して調べてください。",
    "対応範囲外の質問（例: 雑談、創作、プログラミング、一般的な知識問題、個人的な趣味や買い物の相談など、行政と関係のない内容）には回答しないでください。その場合は「申し訳ありませんが、そのご質問はスコープ外のためお答えできません。私は行政相談用のチャットボットですので、行政手続きや公的制度などについてご相談ください。」という趣旨を短く伝えるだけにし、質問の中身には答えないでください。",
  ];
}

function chatPrompt() {
  return [
    "あなたは行政相談用のチャットボットです。親切かつ簡潔に、ユーザーと同じ言語で答えてください。",
    ...scopeRules(),
    "挨拶や、このチャットボット自身（名前・目的・運営者・利用料・できること・使い方）についての質問は対応範囲内です。下の自己紹介情報をもとに短く答えたうえで行政相談を促してください。行政と関係があるか判断に迷う場合は、行政に関わる部分について答えてください。",
    BOT_PROFILE,
    `今日は ${todayJst()}（日本時間）です。`,
    "これはチャットです。人と会話するように、短く自然に返してください。",
    "- 1回の返答は基本 2〜4 文（日本語なら 200 字程度まで）。まず結論を一言で。",
    "- 見出し（#）、表、長い箇条書き、太字の多用はしない。箇条書きが必要なときも 3 項目まで。",
    "- 全部を一度に説明しようとせず、要点だけ答えて、必要なら「〇〇についても詳しく話しましょうか？」と続きを聞く。",
    "- ユーザーが詳しい説明・一覧・手順などを明示的に求めたときだけ、長めに答えてよい。",
    WEB_SEARCH
      ? `Web 検索は政府・自治体の公式サイト（${ALLOWED_DOMAINS.join(" / ")} ドメイン）だけを対象にしています。Web 検索結果が与えられた場合、最新の事実や数値はそれを根拠に答えてください。出典として示してよいのはこれらの公式サイトだけです。それ以外のサイト（民間のまとめサイト・ブログ・ニュースサイト等）を出典として示したり、そこにある情報を根拠にしたりしないでください。`
      + "出典は本文中に [サイト名](URL) の形で 1〜2 個だけ添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
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
      ? `Web 検索は政府・自治体の公式サイト（${ALLOWED_DOMAINS.join(" / ")} ドメイン）だけを対象にしています。出典として示してよいのはこれらの公式サイトだけです。`
        + "Web 検索結果が与えられた場合、制度の要件・金額・申請期限はそれを根拠に書いてください。出典は [サイト名](URL) の形で添え、URL をそのまま貼らないでください。検索結果で確認できないことは推測と明示してください。"
      : "Web 検索が使えないため、金額・期限などは古い可能性があることを案内の最後に明記し、必ず申請先で最新情報を確認するよう伝えてください。",
  ];
}

// 「やさしい日本語」モード: 高齢の方や日本語に不慣れな方にも読みやすい表現で答える
const EASY_JAPANESE_PROMPT = [
  "【やさしい日本語モード】ユーザーは「やさしい日本語」での回答を希望しています。日本語で答える場合は次を守ってください。",
  "- 1 文を短くする（目安 30 字以内）。1 つの文で 1 つのことだけを言う。",
  "- 難しい言葉・漢語・カタカナ語はできるだけ使わず、ふだんの言葉に言いかえる。",
  "- 制度名や手続き名など、言いかえられない専門用語は、そのあとにかっこ書きでやさしい説明を付ける（例: 住民票（住んでいる場所を証明する書類））。",
  "- 二重否定、あいまいな言い方、敬語の重ねすぎ（「〜させていただきます」など）は避け、「です・ます」でていねいに書く。",
  "- 日付・時間・金額・電話番号などの数字は省略せずにはっきり書く。",
].join("\n");

function systemPrompt(mode: Mode, easyJapanese = false) {
  return [
    ...(mode === "support" ? supportPrompt() : chatPrompt()),
    BLOCKED_TOPIC_RULE,
    easyJapanese ? EASY_JAPANESE_PROMPT : "",
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

function plain(text: string, status: number, headers: Record<string, string> = {}) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set");
    return plain("サーバーの設定に問題があります。", 500);
  }

  if (isCrossSite(req)) {
    return plain("許可されていない送信元です。", 403);
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return plain("リクエストの形式が不正です。", 415);
  }

  const limited = rateLimit(clientIp(req));
  if (!limited.ok) {
    return plain(limited.message, 429, {
      "Retry-After": String(limited.retryAfter),
    });
  }

  if (Number(req.headers.get("content-length") ?? "0") > LIMITS.bodyBytes) {
    return plain("リクエストが大きすぎます。", 413);
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > LIMITS.bodyBytes) {
      return plain("リクエストが大きすぎます。", 413);
    }
    raw = JSON.parse(text);
  } catch {
    return plain("リクエストの形式が不正です。", 400);
  }

  const parsed = parseMessages(raw);
  if (!parsed.ok) return plain(parsed.error, 400);
  const messages: ChatMessage[] = parsed.messages;
  const mode: Mode =
    (raw as { mode?: unknown }).mode === "support" ? "support" : "chat";
  const easyJapanese = (raw as { easyJapanese?: unknown }).easyJapanese === true;

  // 回答しない話題（blocked.ts）に触れる質問には、LLM を呼ばずに定型文だけを返す
  if (mentionsBlockedTopic(messages[messages.length - 1].content)) {
    return plain(BLOCKED_REPLY, 200);
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    // クライアントが切断したら上流の生成も止める（無駄なトークン消費を防ぐ）
    signal: req.signal,
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
      // 行政相談は個人情報を含みうるため、入力を学習・保存に使うプロバイダーへはルーティングしない
      provider: { data_collection: "deny" },
      messages: [{ role: "system", content: systemPrompt(mode, easyJapanese) }, ...messages],
      ...(WEB_SEARCH
        ? { plugins: [{ id: "web", include_domains: INCLUDE_DOMAINS }] }
        : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenRouter error", upstream.status, detail.slice(0, 500));
    // 上流のエラー詳細（アカウント・設定情報を含みうる）はクライアントに返さない
    return plain(
      upstream.status === 429
        ? "混み合っています。しばらく待ってからお試しください。"
        : "回答の生成に失敗しました。時間をおいてお試しください。",
      502,
    );
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
              console.error("OpenRouter stream error", chunk.error.message);
              controller.enqueue(encoder.encode("\n\n[エラーが発生しました。]"));
              continue;
            }
            const delta = chunk.choices?.[0]?.delta;
            for (const a of delta?.annotations ?? []) {
              const url = a.url_citation?.url && safeCitationUrl(a.url_citation.url);
              // 念のため許可ドメイン以外の出典は表示しない
              if (
                a.type === "url_citation" &&
                url &&
                isAllowedUrl(url) &&
                !citations.has(url)
              ) {
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
      "Cache-Control": "no-store",
    },
  });
}
