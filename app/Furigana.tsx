"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

// 振り仮名（HTML の <ruby> 要素）表示。
// 読みはサーバーの /api/furigana（kuromoji による形態素解析）で求め、
// 同じ文字列の結果はキャッシュする。短時間に要求された文字列はまとめて 1 回で問い合わせる。

type Segment = [string] | [string, string];

export const FuriganaContext = createContext(false);

const HAS_KANJI = /[\p{Script=Han}々〆ヶ]/u;

const cache = new Map<string, Segment[]>();
const queued = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function flush() {
  timer = null;
  const texts = [...queued];
  queued.clear();
  texts.forEach((t) => inflight.add(t));
  try {
    const res = await fetch("/api/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { results } = (await res.json()) as { results: Segment[][] };
    texts.forEach((t, i) => cache.set(t, results[i] ?? [[t]]));
  } catch (err) {
    console.error("振り仮名の取得に失敗しました", err);
    // 失敗した文字列は振り仮名なしで表示し、再要求を繰り返さない
    texts.forEach((t) => cache.set(t, [[t]]));
  } finally {
    texts.forEach((t) => inflight.delete(t));
    listeners.forEach((fn) => fn());
  }
}

function request(text: string) {
  if (cache.has(text) || queued.has(text) || inflight.has(text)) return;
  queued.add(text);
  timer ??= setTimeout(flush, 20);
}

function Annotated({ text }: { text: string }) {
  const segments = useSyncExternalStore(
    subscribe,
    () => cache.get(text),
    () => undefined,
  );
  useEffect(() => {
    request(text);
  }, [text]);

  if (!segments) return <>{text}</>;
  return (
    <>
      {segments.map(([base, reading], i) =>
        reading ? (
          <ruby key={i}>
            {base}
            <rp>(</rp>
            <rt>{reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          base
        ),
      )}
    </>
  );
}

/** 振り仮名が有効なら漢字にルビを付けて表示する */
export function FuriganaText({ text }: { text: string }) {
  const enabled = useContext(FuriganaContext);
  if (!enabled || !HAS_KANJI.test(text)) return <>{text}</>;
  return <Annotated text={text} />;
}
