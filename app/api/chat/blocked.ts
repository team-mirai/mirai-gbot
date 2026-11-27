// 回答しない話題（特定の人物についての質問など）
//
// ユーザーの発言にここに挙げた名前が含まれていたら、LLM を呼ばずに定型文だけを返す。
// 代名詞などで間接的に指す質問はシステムプロンプト側（BLOCKED_TOPIC_RULE）で断らせる。

// 表記ゆれ（漢字・ひらがな・カタカナ・ローマ字、姓名の順序）を正規化後の形で並べる
const BLOCKED_NAMES = [
  "古川碧",
  "古川あおい",
  "古川アオイ",
  "ふるかわあおい",
  "フルカワアオイ",
  "furukawaaoi",
  "aoifurukawa",
];

export const BLOCKED_REPLY =
  "申し訳ありませんが、そのご質問にはお答えできません。行政手続きや公的制度などについてご相談ください。";

export const BLOCKED_TOPIC_RULE =
  "「古川碧（ふるかわ あおい）」という人物に関する質問（その人物の経歴・発言・活動・評価・連絡先など、代名詞などで間接的に指す場合も含む）には一切答えないでください。その場合は「申し訳ありませんが、そのご質問にはお答えできません。」とだけ伝え、その人物について知っていることや検索結果には触れないでください。";

// 全角・半角、大文字・小文字、空白や記号（「古川 碧」「Furukawa-Aoi」など）の違いを吸収する
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function mentionsBlockedTopic(text: string): boolean {
  const t = normalize(text);
  return BLOCKED_NAMES.some((name) => t.includes(name));
}
