"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechErrorCode } from "./i18n";

// Web Speech API の最小限の型定義（TypeScript の DOM 型には含まれないため）
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};
type SpeechRecognitionErrorEventLike = { readonly error: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const KNOWN_ERRORS: readonly SpeechErrorCode[] = [
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
];

/**
 * ブラウザの Web Speech API による音声入力。lang は認識する言語（BCP 47。例: "ja-JP"）。
 * onTranscript には認識途中のテキストも含めて、発話開始からの全文が渡される。
 * error は表示言語に合わせて呼び出し側で文言にする。
 */
export function useSpeechRecognition(onTranscript: (text: string) => void, lang = "ja-JP") {
  // SSR とのハイドレーション不一致を避けるため、対応判定はマウント後に行う
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechErrorCode | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript ?? "";
      }
      onTranscriptRef.current(text);
    };
    recognition.onerror = (e) => {
      // 無音・ユーザーによる中断はエラー表示しない
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(
        (KNOWN_ERRORS as readonly string[]).includes(e.error)
          ? (e.error as SpeechErrorCode)
          : "unknown",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    setError(null);
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setError("start-failed");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // 認識結果を破棄して中断する（送信時など）
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.abort();
  }, []);

  return { supported, listening, error, start, stop, cancel };
}
