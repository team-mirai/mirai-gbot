// 画面の文言の多言語対応。言語を追加するときは LOCALES と MESSAGES に 1 つずつ足す。

export const LOCALES = ["ja", "en", "zh", "ko", "vi", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";

// 言語切り替えメニューの表示名（各言語での自称）
export const LOCALE_NAMES: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
  vi: "Tiếng Việt",
  pt: "Português",
};

// <html lang> と音声入力（Web Speech API）に使う BCP 47 タグ
export const LOCALE_TAGS: Record<Locale, string> = {
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  vi: "vi-VN",
  pt: "pt-BR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// ブラウザの言語設定（navigator.languages）から最初に対応している言語を選ぶ。
// "zh-TW" → zh、"pt-PT" → pt のように地域部分は無視する。
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export type SpeechErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "network"
  | "start-failed"
  | "unknown";

export type Messages = {
  supportBadge: string;
  // チャット画面の「新しい相談」ボタン
  reset: string;
  language: string;
  conversation: string;
  // トップ画面（ランディング）
  tagline: string;
  home: string;
  notice: string;
  heroLead: string;
  askLabel: string;
  askPlaceholder: string;
  askButton: string;
  suggestionsLabel: string;
  // 「よくある質問」のボタン
  examples: string[];
  topicsTitle: string;
  topics: { title: string; desc: string; q: string }[];
  footerAvailable: string;
  footerDisclaimer: string;
  fontSize: string;
  fontSizeLabels: Record<"normal" | "large" | "xlarge", string>;
  supportButton: string;
  supportNote: string;
  // 「支援制度を探す」を押したときにユーザー発言として送る文
  supportStart: string;
  you: string;
  error: string;
  typing: string;
  inputLabel: string;
  placeholder: string;
  placeholderSupport: string;
  placeholderListening: string;
  micStart: string;
  micStop: string;
  send: string;
  errorGeneric: string;
  errorBusy: string;
  // 回答末尾に付ける出典の見出し（サーバー側で使う）
  sources: string;
  speechErrors: Record<SpeechErrorCode, string>;
};

export const MESSAGES: Record<Locale, Messages> = {
  ja: {
    supportBadge: "支援制度を探す",
    reset: "新しい相談",
    language: "言語",
    conversation: "会話",
    tagline: "行政相談 AI アシスタント",
    home: "mirai-gbot トップに戻る",
    notice: "AI がお答えする行政相談のご案内です。正式な手続きは各行政機関の窓口・公式サイトでご確認ください。",
    heroLead: "行政の手続きや制度について、何をお知りになりたいですか？",
    askLabel: "相談したい内容",
    askPlaceholder: "例：引っ越したら何をすればいい？",
    askButton: "聞いてみる",
    suggestionsLabel: "よくある質問",
    examples: [
      "引っ越しのときに必要な手続きは？",
      "児童手当はどうやって申請する？",
      "マイナンバーカードの更新方法",
      "確定申告が必要なのはどんな人？",
    ],
    topicsTitle: "テーマから探す",
    topics: [
      { title: "くらし・住まい", desc: "転入・転出、住民票、戸籍", q: "転入届の出し方と必要なものを教えて" },
      { title: "子育て・教育", desc: "出産、児童手当、保育園", q: "子どもが生まれたら必要な手続きは？" },
      { title: "税金", desc: "確定申告、住民税、控除", q: "確定申告のやり方をざっくり教えて" },
      { title: "年金・保険", desc: "国民年金、健康保険", q: "会社を辞めたら年金と健康保険はどうなる？" },
      { title: "健康・福祉", desc: "介護、障害福祉、医療費", q: "親の介護が必要になったらまず何をすればいい？" },
      { title: "仕事", desc: "失業給付、職業訓練", q: "失業手当をもらうための手続きは？" },
      { title: "防災・災害", desc: "避難、被災者支援", q: "災害で家が被害を受けたときに使える支援は？" },
      { title: "マイナンバー", desc: "カード、マイナポータル", q: "マイナンバーカードでできることは？" },
    ],
    footerAvailable: "24 時間いつでも、日本語以外の言語でもご相談いただけます。",
    footerDisclaimer: "AI の回答には誤りが含まれる場合があります。個人情報は入力しないでください。",
    fontSize: "文字サイズ",
    fontSizeLabels: { normal: "標準", large: "大", xlarge: "特大" },
    supportButton: "使える支援制度を探す",
    supportNote:
      "いくつかの質問にお答えいただくと、利用できそうな給付・手当・減免・相談窓口をご案内します。",
    supportStart: "使える支援制度を探したいです。",
    you: "あなた",
    error: "エラー",
    typing: "回答を作成中…",
    inputLabel: "メッセージ",
    placeholder: "続けて質問する",
    placeholderSupport: "状況を入力（個人情報は不要です）",
    placeholderListening: "お話しください…",
    micStart: "音声で入力",
    micStop: "音声入力を停止",
    send: "送信",
    errorGeneric: "エラーが発生しました。",
    errorBusy: "混み合っています。しばらく待ってからお試しください。",
    sources: "出典",
    speechErrors: {
      "not-allowed": "マイクの使用が許可されていません。ブラウザの設定を確認してください。",
      "service-not-allowed": "このブラウザでは音声入力を利用できません。",
      "audio-capture": "マイクが見つかりません。",
      network: "音声認識サービスに接続できませんでした。",
      "start-failed": "音声入力を開始できませんでした。",
      unknown: "音声入力でエラーが発生しました。",
    },
  },
  en: {
    supportBadge: "Find support programs",
    reset: "New question",
    language: "Language",
    conversation: "Conversation",
    tagline: "AI assistant for public services",
    home: "Back to mirai-gbot home",
    notice: "This is AI-powered guidance on public services. Please confirm official procedures with the relevant government office or its official website.",
    heroLead: "What would you like to know about administrative procedures or public services in Japan?",
    askLabel: "What would you like to ask?",
    askPlaceholder: "e.g. What do I need to do after moving?",
    askButton: "Ask",
    suggestionsLabel: "Frequently asked questions",
    examples: [
      "How do I get a certificate of residence (juminhyo)?",
      "What should I do if I lose my My Number Card?",
      "Where can foreign residents get help with living in Japan?",
    ],
    topicsTitle: "Browse by topic",
    topics: [
      { title: "Living & housing", desc: "Moving in/out, residence certificate, family register", q: "How do I submit a moving-in notification and what do I need?" },
      { title: "Children & education", desc: "Childbirth, child allowance, daycare", q: "What procedures are needed when a baby is born?" },
      { title: "Taxes", desc: "Tax return, resident tax, deductions", q: "Briefly explain how to file a tax return." },
      { title: "Pension & insurance", desc: "National pension, health insurance", q: "What happens to my pension and health insurance if I leave my job?" },
      { title: "Health & welfare", desc: "Nursing care, disability welfare, medical costs", q: "What should I do first if my parent needs nursing care?" },
      { title: "Work", desc: "Unemployment benefits, job training", q: "What is the procedure to receive unemployment benefits?" },
      { title: "Disasters", desc: "Evacuation, support for disaster victims", q: "What support is available if my home is damaged by a disaster?" },
      { title: "My Number", desc: "Card, Mynaportal", q: "What can I do with my My Number Card?" },
    ],
    footerAvailable: "You can ask anytime, 24 hours a day, in languages other than Japanese too.",
    footerDisclaimer: "AI answers may contain mistakes. Please do not enter personal information.",
    fontSize: "Text size",
    fontSizeLabels: { normal: "Normal", large: "Large", xlarge: "Extra large" },
    supportButton: "Find support programs for me",
    supportNote:
      "Answer a few questions and we will show benefits, allowances, fee reductions, and support desks you may be able to use.",
    supportStart: "I would like to find support programs I can use.",
    you: "You",
    error: "Error",
    typing: "Writing a reply…",
    inputLabel: "Message",
    placeholder: "Ask a follow-up question",
    placeholderSupport: "Describe your situation (no personal information needed)",
    placeholderListening: "Please speak…",
    micStart: "Voice input",
    micStop: "Stop voice input",
    send: "Send",
    errorGeneric: "An error occurred. Please try again later.",
    errorBusy: "The service is busy. Please wait a moment and try again.",
    sources: "Sources",
    speechErrors: {
      "not-allowed": "Microphone access is not allowed. Please check your browser settings.",
      "service-not-allowed": "Voice input is not available in this browser.",
      "audio-capture": "No microphone was found.",
      network: "Could not connect to the speech recognition service.",
      "start-failed": "Could not start voice input.",
      unknown: "An error occurred during voice input.",
    },
  },
  zh: {
    supportBadge: "查找支援制度",
    reset: "新的咨询",
    language: "语言",
    conversation: "对话",
    tagline: "行政咨询 AI 助手",
    home: "返回 mirai-gbot 首页",
    notice: "这是由 AI 回答的行政咨询服务。正式手续请向各行政机关的窗口或官方网站确认。",
    heroLead: "关于日本的行政手续和制度，您想了解什么？",
    askLabel: "想咨询的内容",
    askPlaceholder: "例：搬家后需要办理哪些手续？",
    askButton: "提问",
    suggestionsLabel: "常见问题",
    examples: [
      "怎样办理住民票？",
      "个人编号卡（My Number卡）丢了怎么办？",
      "外国居民在日本生活遇到困难可以去哪里咨询？",
    ],
    topicsTitle: "按主题查找",
    topics: [
      { title: "生活・住房", desc: "迁入・迁出、住民票、户籍", q: "请告诉我如何办理迁入申报以及需要准备什么" },
      { title: "育儿・教育", desc: "生育、儿童津贴、保育园", q: "孩子出生后需要办理哪些手续？" },
      { title: "税务", desc: "报税、住民税、扣除", q: "请简单介绍一下怎么报税（确定申告）" },
      { title: "年金・保险", desc: "国民年金、健康保险", q: "辞职后年金和健康保险会怎样？" },
      { title: "健康・福利", desc: "护理、残疾人福利、医疗费", q: "父母需要护理时首先该做什么？" },
      { title: "工作", desc: "失业补助、职业培训", q: "领取失业补助需要办理什么手续？" },
      { title: "防灾・灾害", desc: "避难、受灾者支援", q: "房屋因灾害受损时可以使用哪些支援？" },
      { title: "个人编号", desc: "个人编号卡、Mynaportal", q: "个人编号卡可以用来做什么？" },
    ],
    footerAvailable: "24 小时随时可以咨询，也可以使用日语以外的语言。",
    footerDisclaimer: "AI 的回答可能包含错误。请不要输入个人信息。",
    fontSize: "字号",
    fontSizeLabels: { normal: "标准", large: "大", xlarge: "特大" },
    supportButton: "查找可以使用的支援制度",
    supportNote: "回答几个问题后，我们会为您介绍可能适用的补助、津贴、减免和咨询窗口。",
    supportStart: "我想查找我可以使用的支援制度。",
    you: "您",
    error: "错误",
    typing: "正在生成回答…",
    inputLabel: "消息",
    placeholder: "继续提问",
    placeholderSupport: "请输入您的情况（无需个人信息）",
    placeholderListening: "请说话…",
    micStart: "语音输入",
    micStop: "停止语音输入",
    send: "发送",
    errorGeneric: "发生错误，请稍后再试。",
    errorBusy: "当前访问人数较多，请稍后再试。",
    sources: "出处",
    speechErrors: {
      "not-allowed": "未允许使用麦克风。请检查浏览器设置。",
      "service-not-allowed": "此浏览器无法使用语音输入。",
      "audio-capture": "未找到麦克风。",
      network: "无法连接到语音识别服务。",
      "start-failed": "无法开始语音输入。",
      unknown: "语音输入时发生错误。",
    },
  },
  ko: {
    supportBadge: "지원 제도 찾기",
    reset: "새 상담",
    language: "언어",
    conversation: "대화",
    tagline: "행정 상담 AI 어시스턴트",
    home: "mirai-gbot 처음 화면으로",
    notice: "AI가 답변하는 행정 상담 안내입니다. 정식 절차는 각 행정기관의 창구나 공식 사이트에서 확인해 주세요.",
    heroLead: "일본의 행정 절차나 제도에 대해 무엇이 궁금하신가요?",
    askLabel: "상담하고 싶은 내용",
    askPlaceholder: "예: 이사하면 무엇을 해야 하나요?",
    askButton: "물어보기",
    suggestionsLabel: "자주 묻는 질문",
    examples: [
      "주민표는 어떻게 발급받나요?",
      "마이넘버 카드를 잃어버렸을 때는 어떻게 해야 하나요?",
      "외국인 주민이 생활 상담을 받을 수 있는 곳이 있나요?",
    ],
    topicsTitle: "주제별로 찾기",
    topics: [
      { title: "생활・주거", desc: "전입・전출, 주민표, 호적", q: "전입신고 방법과 필요한 것을 알려 주세요" },
      { title: "육아・교육", desc: "출산, 아동수당, 보육원", q: "아이가 태어나면 필요한 절차는?" },
      { title: "세금", desc: "확정신고, 주민세, 공제", q: "확정신고 방법을 간단히 알려 주세요" },
      { title: "연금・보험", desc: "국민연금, 건강보험", q: "회사를 그만두면 연금과 건강보험은 어떻게 되나요?" },
      { title: "건강・복지", desc: "간병, 장애인 복지, 의료비", q: "부모님 간병이 필요해지면 먼저 무엇을 해야 하나요?" },
      { title: "일", desc: "실업급여, 직업훈련", q: "실업급여를 받기 위한 절차는?" },
      { title: "방재・재해", desc: "대피, 이재민 지원", q: "재해로 집이 피해를 입었을 때 받을 수 있는 지원은?" },
      { title: "마이넘버", desc: "카드, 마이나포털", q: "마이넘버 카드로 할 수 있는 것은?" },
    ],
    footerAvailable: "24시간 언제든지, 일본어 이외의 언어로도 상담하실 수 있습니다.",
    footerDisclaimer: "AI의 답변에는 오류가 있을 수 있습니다. 개인정보는 입력하지 마세요.",
    fontSize: "글자 크기",
    fontSizeLabels: { normal: "보통", large: "크게", xlarge: "아주 크게" },
    supportButton: "이용할 수 있는 지원 제도 찾기",
    supportNote:
      "몇 가지 질문에 답해 주시면 이용할 수 있을 것 같은 급부·수당·감면·상담 창구를 안내해 드립니다.",
    supportStart: "제가 이용할 수 있는 지원 제도를 찾고 싶어요.",
    you: "나",
    error: "오류",
    typing: "답변 작성 중…",
    inputLabel: "메시지",
    placeholder: "이어서 질문하기",
    placeholderSupport: "상황을 입력하세요 (개인정보는 필요 없습니다)",
    placeholderListening: "말씀해 주세요…",
    micStart: "음성 입력",
    micStop: "음성 입력 중지",
    send: "전송",
    errorGeneric: "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    errorBusy: "현재 이용자가 많습니다. 잠시 후 다시 시도해 주세요.",
    sources: "출처",
    speechErrors: {
      "not-allowed": "마이크 사용이 허용되지 않았습니다. 브라우저 설정을 확인해 주세요.",
      "service-not-allowed": "이 브라우저에서는 음성 입력을 사용할 수 없습니다.",
      "audio-capture": "마이크를 찾을 수 없습니다.",
      network: "음성 인식 서비스에 연결할 수 없습니다.",
      "start-failed": "음성 입력을 시작할 수 없습니다.",
      unknown: "음성 입력 중 오류가 발생했습니다.",
    },
  },
  vi: {
    supportBadge: "Tìm chế độ hỗ trợ",
    reset: "Câu hỏi mới",
    language: "Ngôn ngữ",
    conversation: "Hội thoại",
    tagline: "Trợ lý AI tư vấn hành chính",
    home: "Quay về trang chủ mirai-gbot",
    notice: "Đây là dịch vụ tư vấn hành chính do AI trả lời. Vui lòng xác nhận thủ tục chính thức tại quầy hoặc trang web chính thức của cơ quan hành chính.",
    heroLead: "Bạn muốn biết gì về thủ tục hành chính và các chế độ tại Nhật Bản?",
    askLabel: "Nội dung bạn muốn hỏi",
    askPlaceholder: "Ví dụ: Sau khi chuyển nhà cần làm gì?",
    askButton: "Hỏi",
    suggestionsLabel: "Câu hỏi thường gặp",
    examples: [
      "Làm thế nào để lấy phiếu cư trú (juminhyo)?",
      "Tôi phải làm gì khi bị mất thẻ My Number?",
      "Người nước ngoài có thể được tư vấn về cuộc sống ở Nhật tại đâu?",
    ],
    topicsTitle: "Tìm theo chủ đề",
    topics: [
      { title: "Đời sống & nhà ở", desc: "Chuyển đến/chuyển đi, phiếu cư trú, hộ tịch", q: "Hãy cho tôi biết cách nộp đơn chuyển đến và những gì cần chuẩn bị" },
      { title: "Nuôi con & giáo dục", desc: "Sinh con, trợ cấp nhi đồng, nhà trẻ", q: "Khi sinh con cần làm những thủ tục gì?" },
      { title: "Thuế", desc: "Khai thuế, thuế cư trú, khấu trừ", q: "Hãy giải thích sơ lược cách khai thuế cuối năm (kakutei shinkoku)" },
      { title: "Lương hưu & bảo hiểm", desc: "Lương hưu quốc dân, bảo hiểm y tế", q: "Nghỉ việc thì lương hưu và bảo hiểm y tế sẽ thế nào?" },
      { title: "Sức khỏe & phúc lợi", desc: "Chăm sóc điều dưỡng, phúc lợi người khuyết tật, chi phí y tế", q: "Khi cha mẹ cần chăm sóc điều dưỡng thì trước tiên nên làm gì?" },
      { title: "Việc làm", desc: "Trợ cấp thất nghiệp, đào tạo nghề", q: "Thủ tục để nhận trợ cấp thất nghiệp là gì?" },
      { title: "Phòng chống thiên tai", desc: "Sơ tán, hỗ trợ người bị thiên tai", q: "Khi nhà bị thiệt hại do thiên tai thì có những hỗ trợ nào?" },
      { title: "My Number", desc: "Thẻ, Mynaportal", q: "Thẻ My Number dùng để làm gì?" },
    ],
    footerAvailable: "Bạn có thể hỏi bất cứ lúc nào, 24 giờ, kể cả bằng ngôn ngữ khác ngoài tiếng Nhật.",
    footerDisclaimer: "Câu trả lời của AI có thể có sai sót. Vui lòng không nhập thông tin cá nhân.",
    fontSize: "Cỡ chữ",
    fontSizeLabels: { normal: "Thường", large: "Lớn", xlarge: "Rất lớn" },
    supportButton: "Tìm chế độ hỗ trợ tôi có thể dùng",
    supportNote:
      "Chỉ cần trả lời vài câu hỏi, chúng tôi sẽ giới thiệu các khoản trợ cấp, phụ cấp, miễn giảm và quầy tư vấn mà bạn có thể sử dụng.",
    supportStart: "Tôi muốn tìm các chế độ hỗ trợ mà tôi có thể sử dụng.",
    you: "Bạn",
    error: "Lỗi",
    typing: "Đang soạn câu trả lời…",
    inputLabel: "Tin nhắn",
    placeholder: "Hỏi tiếp",
    placeholderSupport: "Nhập tình trạng của bạn (không cần thông tin cá nhân)",
    placeholderListening: "Mời bạn nói…",
    micStart: "Nhập bằng giọng nói",
    micStop: "Dừng nhập bằng giọng nói",
    send: "Gửi",
    errorGeneric: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
    errorBusy: "Hệ thống đang đông. Vui lòng đợi một lát rồi thử lại.",
    sources: "Nguồn",
    speechErrors: {
      "not-allowed": "Chưa cho phép sử dụng micrô. Vui lòng kiểm tra cài đặt trình duyệt.",
      "service-not-allowed": "Trình duyệt này không hỗ trợ nhập bằng giọng nói.",
      "audio-capture": "Không tìm thấy micrô.",
      network: "Không thể kết nối với dịch vụ nhận dạng giọng nói.",
      "start-failed": "Không thể bắt đầu nhập bằng giọng nói.",
      unknown: "Đã xảy ra lỗi khi nhập bằng giọng nói.",
    },
  },
  pt: {
    supportBadge: "Buscar programas de apoio",
    reset: "Nova consulta",
    language: "Idioma",
    conversation: "Conversa",
    tagline: "Assistente de IA para serviços públicos",
    home: "Voltar ao início do mirai-gbot",
    notice: "Este é um serviço de orientação sobre serviços públicos respondido por IA. Confirme os procedimentos oficiais no balcão ou no site oficial do órgão responsável.",
    heroLead: "O que você gostaria de saber sobre procedimentos administrativos e serviços públicos no Japão?",
    askLabel: "O que você quer perguntar",
    askPlaceholder: "Ex.: O que preciso fazer depois de me mudar?",
    askButton: "Perguntar",
    suggestionsLabel: "Perguntas frequentes",
    examples: [
      "Como faço para tirar o atestado de residência (juminhyo)?",
      "O que devo fazer se perder meu cartão My Number?",
      "Onde estrangeiros podem pedir orientação sobre a vida no Japão?",
    ],
    topicsTitle: "Buscar por tema",
    topics: [
      { title: "Vida e moradia", desc: "Mudança, atestado de residência, registro familiar", q: "Como faço a notificação de mudança (tennyu) e o que preciso levar?" },
      { title: "Filhos e educação", desc: "Parto, auxílio infantil, creche", q: "Quais procedimentos são necessários quando um bebê nasce?" },
      { title: "Impostos", desc: "Declaração de imposto, imposto residencial, deduções", q: "Explique de forma simples como fazer a declaração de imposto (kakutei shinkoku)." },
      { title: "Previdência e seguro", desc: "Previdência nacional, seguro de saúde", q: "O que acontece com minha previdência e seguro de saúde se eu sair do emprego?" },
      { title: "Saúde e bem-estar", desc: "Cuidados de longa duração, bem-estar de pessoas com deficiência, despesas médicas", q: "O que devo fazer primeiro se meus pais precisarem de cuidados?" },
      { title: "Trabalho", desc: "Seguro-desemprego, capacitação profissional", q: "Qual é o procedimento para receber o seguro-desemprego?" },
      { title: "Desastres", desc: "Evacuação, apoio às vítimas", q: "Que apoio existe se minha casa for danificada por um desastre?" },
      { title: "My Number", desc: "Cartão, Mynaportal", q: "O que posso fazer com o cartão My Number?" },
    ],
    footerAvailable: "Você pode perguntar a qualquer hora, 24 horas por dia, também em idiomas além do japonês.",
    footerDisclaimer: "As respostas da IA podem conter erros. Não digite informações pessoais.",
    fontSize: "Tamanho do texto",
    fontSizeLabels: { normal: "Normal", large: "Grande", xlarge: "Muito grande" },
    supportButton: "Buscar programas de apoio para mim",
    supportNote:
      "Responda a algumas perguntas e mostraremos benefícios, auxílios, reduções de taxas e balcões de atendimento que você pode usar.",
    supportStart: "Quero encontrar programas de apoio que eu possa usar.",
    you: "Você",
    error: "Erro",
    typing: "Escrevendo a resposta…",
    inputLabel: "Mensagem",
    placeholder: "Faça outra pergunta",
    placeholderSupport: "Descreva sua situação (não é preciso informar dados pessoais)",
    placeholderListening: "Pode falar…",
    micStart: "Entrada por voz",
    micStop: "Parar entrada por voz",
    send: "Enviar",
    errorGeneric: "Ocorreu um erro. Tente novamente mais tarde.",
    errorBusy: "O serviço está ocupado. Aguarde um momento e tente novamente.",
    sources: "Fontes",
    speechErrors: {
      "not-allowed": "O uso do microfone não foi permitido. Verifique as configurações do navegador.",
      "service-not-allowed": "A entrada por voz não está disponível neste navegador.",
      "audio-capture": "Nenhum microfone foi encontrado.",
      network: "Não foi possível conectar ao serviço de reconhecimento de voz.",
      "start-failed": "Não foi possível iniciar a entrada por voz.",
      unknown: "Ocorreu um erro na entrada por voz.",
    },
  },
};
