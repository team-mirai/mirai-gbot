export const runtime = "nodejs";
export const maxDuration = 60;

// OpenRouter 経由で Claude を呼び出す（OpenAI 互換の Chat Completions API）
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-5.5";
const SYSTEM_PROMPT =
  "あなたは親切で簡潔なアシスタントです。ユーザーと同じ言語で答えてください。";

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
      max_tokens: 16000,
      reasoning: { effort: "low" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
              choices?: { delta?: { content?: string } }[];
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
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
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
