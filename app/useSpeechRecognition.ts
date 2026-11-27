"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "マイクの使用が許可されていません。ブラウザの設定を確認してください。",
  "service-not-allowed": "このブラウザでは音声入力を利用できません。",
  "audio-capture": "マイクが見つかりません。",
  network: "音声認識サービスに接続できませんでした。",
};

/**
 * ブラウザの Web Speech API による日本語の音声入力。
 * onTranscript には認識途中のテキストも含めて、発話開始からの全文が渡される。
 */
export function useSpeechRecognition(onTranscript: (text: string) => void) {
  // SSR とのハイドレーション不一致を避けるため、対応判定はマウント後に行う
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    recognition.lang = "ja-JP";
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
      setError(ERROR_MESSAGES[e.error] ?? "音声入力でエラーが発生しました。");
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
      setError("音声入力を開始できませんでした。");
    }
  }, []);

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
