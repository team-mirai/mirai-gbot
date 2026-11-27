"use client";

import { forwardRef } from "react";

// 「できること・使い方」の一覧。内容は app/api/chat/route.ts のシステムプロンプト
// （対応範囲・自己紹介情報）と食い違わないようにすること。
const TOPICS: { title: string; examples: string[] }[] = [
  {
    title: "行政手続き・届出・申請",
    examples: [
      "住民票の取り方を教えてください",
      "引っ越しのときに必要な手続きを教えてください",
      "マイナンバーカードをなくしたときはどうすればいいですか？",
    ],
  },
  {
    title: "税金",
    examples: [
      "確定申告が必要なのはどんな人ですか？",
      "ふるさと納税の仕組みを教えてください",
    ],
  },
  {
    title: "年金・保険",
    examples: [
      "国民年金の保険料を払えないときはどうすればいいですか？",
      "会社を辞めたあとの健康保険はどうなりますか？",
    ],
  },
  {
    title: "福祉・介護",
    examples: [
      "介護保険のサービスを使うにはどうすればいいですか？",
      "生活に困ったときに相談できる窓口はありますか？",
    ],
  },
  {
    title: "子育て・教育",
    examples: [
      "児童手当はいつ、いくらもらえますか？",
      "保育園の申し込み方法を教えてください",
    ],
  },
  {
    title: "給付・補助金などの支援制度",
    examples: ["失業したときに使える支援制度はありますか？"],
  },
  {
    title: "行政の窓口・連絡先",
    examples: ["パスポートの申請はどこでできますか？"],
  },
];

const CANNOT = [
  "個別の審査結果や、受給・認定できるかどうかの判定",
  "申請の代行や受付（申請は各窓口・公式サイトで行ってください）",
  "行政と関係のない話題（雑談・創作・プログラミング・買い物の相談など）",
  "特定の政党や候補者への投票の推奨",
];

type Props = {
  onClose: () => void;
  // 質問例を選んだときに呼ばれる（入力欄に入れる）
  onPickExample: (question: string) => void;
};

export const GuideDialog = forwardRef<HTMLDialogElement, Props>(function GuideDialog(
  { onClose, onPickExample },
  ref,
) {
  return (
    <dialog
      ref={ref}
      className="guide"
      aria-labelledby="guide-title"
      onClick={(e) => {
        // 背景（ダイアログの外側）をクリックしたら閉じる
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="guide-inner">
        <div className="guide-header">
          <h2 id="guide-title" className="guide-title">
            できること・使い方
          </h2>
          <button type="button" className="header-button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <section aria-labelledby="guide-howto">
          <h3 id="guide-howto" className="guide-heading">
            使い方
          </h3>
          <ol className="guide-list">
            <li>画面下の入力欄に、知りたいことを文章で入力して送信します（マイクボタンで音声入力もできます）。</li>
            <li>行政手続きや公的制度について、AI が政府・自治体の公式サイトを調べて答えます。参照したページは出典として表示されます。</li>
            <li>
              最初の画面の「使える支援制度を探す」を押すと、いくつかの質問に答えるだけで、利用できそうな給付・手当・減免・相談窓口を一覧で案内します。
            </li>
          </ol>
        </section>

        <section aria-labelledby="guide-topics">
          <h3 id="guide-topics" className="guide-heading">
            相談できること
          </h3>
          <p className="guide-note">質問例を押すと入力欄に入ります。</p>
          <dl className="guide-topics">
            {TOPICS.map((t) => (
              <div key={t.title} className="guide-topic">
                <dt>{t.title}</dt>
                {t.examples.map((q) => (
                  <dd key={q}>
                    <button
                      type="button"
                      className="guide-example"
                      onClick={() => onPickExample(q)}
                    >
                      {q}
                    </button>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="guide-cannot">
          <h3 id="guide-cannot" className="guide-heading">
            できないこと
          </h3>
          <ul className="guide-list">
            {CANNOT.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="guide-caution">
          <h3 id="guide-caution" className="guide-heading">
            ご注意
          </h3>
          <ul className="guide-list">
            <li>回答は AI によるもので、誤りを含むことがあります。最終的な判断は公式サイトや窓口でご確認ください。</li>
            <li>マイナンバー・氏名・住所・電話番号などの個人情報は入力しないでください。</li>
          </ul>
        </section>
      </div>
    </dialog>
  );
});
