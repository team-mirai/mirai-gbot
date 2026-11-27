// 生活困窮・DV・虐待・自殺念慮など、緊急性の高い相談で最初に案内する専門窓口。
// 番号や受付時間は変わることがあるため、出典（公的なページ）を定期的に確認し、
// 見直したら REVIEWED_AT を更新すること（README「緊急性の高い相談の案内」参照）。

export const REVIEWED_AT = "2026-11";

type Hotline = {
  /** 窓口名と連絡先（モデルにそのまま見せる） */
  label: string;
  /** 受付時間などの補足 */
  note: string;
  /** 確認に使う公的なページ */
  source: string;
};

type CrisisCategory = {
  /** どんな相談がこのカテゴリに当たるか */
  signs: string;
  hotlines: Hotline[];
};

export const CRISIS_CATEGORIES: CrisisCategory[] = [
  {
    signs:
      "自殺念慮・強い精神的な苦痛（「死にたい」「消えたい」「生きているのがつらい」「もう限界」など）",
    hotlines: [
      {
        label: "よりそいホットライン 0120-279-338",
        note: "24 時間・無料。岩手・宮城・福島からは 0120-279-226",
        source: "https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/",
      },
      {
        label: "いのちの電話 0570-783-556（ナビダイヤル）/ 0120-783-556（フリーダイヤル）",
        note: "受付時間は番号ごとに異なる",
        source: "https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/",
      },
      {
        label: "こころの健康相談統一ダイヤル 0570-064-556",
        note: "住んでいる都道府県・政令市の窓口につながる。受付時間は地域ごとに異なる",
        source: "https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/",
      },
    ],
  },
  {
    signs:
      "DV（配偶者・パートナーからの暴力、暴言、生活費を渡さない、行動の制限など）",
    hotlines: [
      {
        label: "DV相談ナビ #8008（はれれば）",
        note: "最寄りの配偶者暴力相談支援センターにつながる",
        source: "https://www.gender.go.jp/policy/no_violence/e-vaw/soudankikan/01.html",
      },
      {
        label: "DV相談＋（プラス） 0120-279-889",
        note: "24 時間。チャット・メールでも相談できる",
        source: "https://www.gender.go.jp/policy/no_violence/e-vaw/soudankikan.html",
      },
    ],
  },
  {
    signs: "子どもへの虐待（自分の子・近所の子が叩かれている、育児放棄、子ども本人からの相談など）",
    hotlines: [
      {
        label: "児童相談所虐待対応ダイヤル 189（いちはやく）",
        note: "24 時間・通話料無料。最寄りの児童相談所につながる。匿名でも通告・相談できる",
        source: "https://kodomoshien.cfa.go.jp/no-gyakutai/189/",
      },
    ],
  },
  {
    signs:
      "生活困窮（食べるものやお金がない、家賃が払えず住まいを失いそう、ライフラインが止められそう、仕事を失い生活できない など）",
    hotlines: [
      {
        label: "お住まいの市区町村の自立相談支援機関（生活困窮者自立支援制度）",
        note: "住まい・仕事・家計の困りごとをまとめて相談できる",
        source: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html",
      },
      {
        label: "お住まいの地域の福祉事務所（生活保護の相談・申請）",
        note: "生活保護の申請は国民の権利。ためらわずに相談してよい",
        source: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/seikatsuhogo/seikatuhogo/index.html",
      },
      {
        label: "よりそいホットライン 0120-279-338",
        note: "24 時間・無料。生活の困りごと全般を相談できる",
        source: "https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/",
      },
    ],
  },
];

/** 緊急性の高い相談の見分け方と案内方法（通常モード・支援制度モード共通） */
export function crisisRules(): string[] {
  return [
    "## 緊急性の高い相談（最優先）",
    "次のような相談は、行政に関する相談として対応範囲内です（スコープ外として断らないでください）。言葉が遠回しでも、文脈から当てはまりそうなら該当として扱ってください。",
    ...CRISIS_CATEGORIES.flatMap((c) => [
      `- ${c.signs}`,
      ...c.hotlines.map((h) => `  - ${h.label}（${h.note}）出典: ${h.source}`),
    ]),
    "- 今まさに命の危険がある、暴力を受けている、けがをしている場合は、まず 110 番（警察）・119 番（救急）を案内する。",
    "該当する場合の返答のしかた:",
    "- 回答の冒頭で、まず相談してくれたことを受け止める一言（例:「話してくださってありがとうございます」）を添え、すぐに上の該当する窓口を 1〜3 個、番号つきで案内する。制度の説明や聞き取りはその後にする。",
    "- 責めたり、説教したり、「がんばって」と励ましすぎたりしない。やさしく短い文で書く。",
    "- 窓口の名前・番号は上の一覧どおりに書き、番号を推測で作らない。受付時間は変わることがあるため、Web 検索結果で確認できない場合は「受付時間は出典のページでご確認ください」と添える。",
    "- 窓口の案内のあとで、関連する公的支援（例: 生活困窮なら住居確保給付金・生活福祉資金貸付・生活保護、DV なら一時保護や配偶者暴力相談支援センター）に短く触れ、「よければ、今の状況をもう少し教えてください」と続きを促す。",
  ];
}
