import { Fragment, ReactNode } from "react";
import { stripRuby } from "./furigana";

// チャット向けの軽量 Markdown レンダラー（外部依存なし・innerHTML 不使用）。
// 対応: 段落 / 改行, 見出し(太字の行として表示), 箇条書き・番号付きリスト,
// 引用, 水平線, コードブロック, インラインの **太字** *斜体* `code`,
// [テキスト](URL) と裸の URL のリンク化、ふりがな（app/furigana.ts の目印 → <ruby>）。

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function Link({ href, children }: { href: string; children: ReactNode }) {
  if (!SAFE_URL.test(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

// 裸の URL 末尾に付きがちな句読点・括弧はリンクに含めない
function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,;:!?。、）)」』】]+$/);
  if (!m) return [url, ""];
  // "(...)" を含む URL（Wikipedia 等）の閉じ括弧は残す
  let trail = m[0];
  let body = url.slice(0, -trail.length);
  while (trail.startsWith(")") && (body.match(/\(/g)?.length ?? 0) > (body.match(/\)/g)?.length ?? 0)) {
    body += ")";
    trail = trail.slice(1);
  }
  return [body, trail];
}

const INLINE =
  /(`[^`\n]+`)|\[([^\]\n]+)\]\((https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)\)|(https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%()\[\]]+)|\*\*([^*\n]+)\*\*|(?<![\w*])\*([^*\n]+)\*(?![\w*])|([^-\n]+)([^-\n]+)/g;

function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}${i++}`;
    if (m[1]) {
      out.push(<code key={key}>{stripRuby(m[1].slice(1, -1))}</code>);
    } else if (m[2] && m[3]) {
      out.push(
        <Link key={key} href={stripRuby(m[3])}>
          {renderInline(m[2], `${key}-`)}
        </Link>,
      );
    } else if (m[4]) {
      const [url, trail] = splitTrailing(m[4]);
      out.push(
        <Link key={key} href={url}>
          {prettyUrl(url)}
        </Link>,
      );
      if (trail) out.push(trail);
    } else if (m[5]) {
      out.push(<strong key={key}>{renderInline(m[5], `${key}-`)}</strong>);
    } else if (m[6]) {
      out.push(<em key={key}>{renderInline(m[6], `${key}-`)}</em>);
    } else if (m[7] && m[8]) {
      out.push(
        <ruby key={key}>
          {m[7]}
          <rt>{m[8]}</rt>
        </ruby>,
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// 裸の URL は長くなりがちなのでドメイン＋短縮パスで表示する
function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = decodeURI(u.pathname).replace(/\/$/, "");
    const shown = host + path;
    return shown.length > 48 ? `${shown.slice(0, 47)}…` : shown;
  } catch {
    return url;
  }
}

function withBreaks(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(l, `${keyPrefix}${i}-`)}
    </Fragment>
  ));
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "h"; text: string }
  | { type: "ul" | "ol"; items: string[]; start: number }
  | { type: "quote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "hr" };

const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*(\d+)[.)]\s+(.*)$/;

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) body.push(lines[i++]);
      i++; // 閉じフェンス（ストリーミング途中で未到達でも可）
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    const h = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", text: h[1].replace(/\s+#+\s*$/, "") });
      i++;
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">"))
        body.push(lines[i++].trimStart().replace(/^>\s?/, ""));
      blocks.push({ type: "quote", lines: body });
      continue;
    }
    const isUl = UL.test(line);
    const ol = line.match(OL);
    if (isUl || ol) {
      const type = isUl ? "ul" : "ol";
      const re = isUl ? UL : OL;
      const items: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(re);
        if (m) items.push(isUl ? m[1] : m[2]);
        else if (items.length) items[items.length - 1] += "\n" + lines[i].trim(); // 継続行
        i++;
        if (i < lines.length && !re.test(lines[i]) && (UL.test(lines[i]) || OL.test(lines[i]))) break;
      }
      blocks.push({ type, items, start: ol ? Number(ol[1]) : 1 });
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !UL.test(lines[i]) &&
      !OL.test(lines[i]) &&
      !/^\s*#{1,6}\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].trimStart().startsWith(">")
    )
      body.push(lines[i++]);
    blocks.push({ type: "p", lines: body });
  }
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {parseBlocks(text).map((b, i) => {
        const k = `${i}-`;
        switch (b.type) {
          case "p":
            return <p key={i}>{withBreaks(b.lines, k)}</p>;
          case "h":
            return (
              <p key={i}>
                <strong>{renderInline(b.text, k)}</strong>
              </p>
            );
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{withBreaks(it.split("\n"), `${k}${j}-`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} start={b.start}>
                {b.items.map((it, j) => (
                  <li key={j}>{withBreaks(it.split("\n"), `${k}${j}-`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return <blockquote key={i}>{withBreaks(b.lines, k)}</blockquote>;
          case "code":
            return (
              <pre key={i}>
                <code>{stripRuby(b.text)}</code>
              </pre>
            );
          case "hr":
            return <hr key={i} />;
        }
      })}
    </div>
  );
}
