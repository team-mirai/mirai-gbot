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
  description: string;
  supportBadge: string;
  reset: string;
  language: string;
  conversation: string;
  welcome: string;
  privacy: string;
  examplesLead: string;
  examples: string[];
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
    description: "行政手続きや公的制度についての疑問に答える、行政相談用のチャットボットです。",
    supportBadge: "支援制度を探す",
    reset: "最初に戻る",
    language: "言語",
    conversation: "会話",
    welcome: "行政手続きや公的制度について、お気軽にご相談ください。",
    privacy: "マイナンバー・氏名・住所・電話番号などの個人情報は入力しないでください。",
    examplesLead: "例えば、こんな質問ができます。",
    examples: [
      "住民票の取り方を教えてください",
      "マイナンバーカードをなくしたときはどうすればいいですか？",
      "引っ越しのときに必要な手続きを教えてください",
    ],
    supportButton: "使える支援制度を探す",
    supportNote:
      "いくつかの質問にお答えいただくと、利用できそうな給付・手当・減免・相談窓口をご案内します。",
    supportStart: "使える支援制度を探したいです。",
    you: "あなた",
    error: "エラー",
    typing: "回答を作成中…",
    inputLabel: "メッセージ",
    placeholder: "メッセージを入力",
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
    description:
      "A chatbot that answers questions about administrative procedures and public services in Japan.",
    supportBadge: "Find support programs",
    reset: "Start over",
    language: "Language",
    conversation: "Conversation",
    welcome: "Feel free to ask about administrative procedures and public services in Japan.",
    privacy:
      "Please do not enter personal information such as your My Number, name, address, or phone number.",
    examplesLead: "For example, you can ask:",
    examples: [
      "How do I get a certificate of residence (juminhyo)?",
      "What should I do if I lose my My Number Card?",
      "Where can foreign residents get help with living in Japan?",
    ],
    supportButton: "Find support programs for me",
    supportNote:
      "Answer a few questions and we will show benefits, allowances, fee reductions, and support desks you may be able to use.",
    supportStart: "I would like to find support programs I can use.",
    you: "You",
    error: "Error",
    typing: "Writing a reply…",
    inputLabel: "Message",
    placeholder: "Type a message",
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
    description: "解答日本行政手续和公共制度相关问题的行政咨询聊天机器人。",
    supportBadge: "查找支援制度",
    reset: "返回首页",
    language: "语言",
    conversation: "对话",
    welcome: "欢迎随时咨询日本的行政手续和公共制度。",
    privacy: "请不要输入个人编号（My Number）、姓名、住址、电话号码等个人信息。",
    examplesLead: "例如，您可以这样提问：",
    examples: [
      "怎样办理住民票？",
      "个人编号卡（My Number卡）丢了怎么办？",
      "外国居民在日本生活遇到困难可以去哪里咨询？",
    ],
    supportButton: "查找可以使用的支援制度",
    supportNote: "回答几个问题后，我们会为您介绍可能适用的补助、津贴、减免和咨询窗口。",
    supportStart: "我想查找我可以使用的支援制度。",
    you: "您",
    error: "错误",
    typing: "正在生成回答…",
    inputLabel: "消息",
    placeholder: "请输入消息",
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
    description: "일본의 행정 절차와 공공 제도에 관한 질문에 답하는 행정 상담용 챗봇입니다.",
    supportBadge: "지원 제도 찾기",
    reset: "처음으로",
    language: "언어",
    conversation: "대화",
    welcome: "일본의 행정 절차나 공공 제도에 대해 편하게 상담해 주세요.",
    privacy: "마이넘버, 이름, 주소, 전화번호 등의 개인정보는 입력하지 마세요.",
    examplesLead: "예를 들어 이런 질문을 할 수 있습니다.",
    examples: [
      "주민표는 어떻게 발급받나요?",
      "마이넘버 카드를 잃어버렸을 때는 어떻게 해야 하나요?",
      "외국인 주민이 생활 상담을 받을 수 있는 곳이 있나요?",
    ],
    supportButton: "이용할 수 있는 지원 제도 찾기",
    supportNote:
      "몇 가지 질문에 답해 주시면 이용할 수 있을 것 같은 급부·수당·감면·상담 창구를 안내해 드립니다.",
    supportStart: "제가 이용할 수 있는 지원 제도를 찾고 싶어요.",
    you: "나",
    error: "오류",
    typing: "답변 작성 중…",
    inputLabel: "메시지",
    placeholder: "메시지를 입력하세요",
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
    description:
      "Chatbot tư vấn hành chính, trả lời các câu hỏi về thủ tục hành chính và chế độ công tại Nhật Bản.",
    supportBadge: "Tìm chế độ hỗ trợ",
    reset: "Quay lại từ đầu",
    language: "Ngôn ngữ",
    conversation: "Hội thoại",
    welcome: "Hãy thoải mái hỏi về thủ tục hành chính và các chế độ công tại Nhật Bản.",
    privacy:
      "Vui lòng không nhập thông tin cá nhân như mã số My Number, họ tên, địa chỉ, số điện thoại.",
    examplesLead: "Ví dụ, bạn có thể hỏi:",
    examples: [
      "Làm thế nào để lấy phiếu cư trú (juminhyo)?",
      "Tôi phải làm gì khi bị mất thẻ My Number?",
      "Người nước ngoài có thể được tư vấn về cuộc sống ở Nhật tại đâu?",
    ],
    supportButton: "Tìm chế độ hỗ trợ tôi có thể dùng",
    supportNote:
      "Chỉ cần trả lời vài câu hỏi, chúng tôi sẽ giới thiệu các khoản trợ cấp, phụ cấp, miễn giảm và quầy tư vấn mà bạn có thể sử dụng.",
    supportStart: "Tôi muốn tìm các chế độ hỗ trợ mà tôi có thể sử dụng.",
    you: "Bạn",
    error: "Lỗi",
    typing: "Đang soạn câu trả lời…",
    inputLabel: "Tin nhắn",
    placeholder: "Nhập tin nhắn",
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
    description:
      "Um chatbot que responde a dúvidas sobre procedimentos administrativos e serviços públicos no Japão.",
    supportBadge: "Buscar programas de apoio",
    reset: "Recomeçar",
    language: "Idioma",
    conversation: "Conversa",
    welcome:
      "Fique à vontade para perguntar sobre procedimentos administrativos e serviços públicos no Japão.",
    privacy:
      "Não digite informações pessoais, como seu My Number, nome, endereço ou telefone.",
    examplesLead: "Por exemplo, você pode perguntar:",
    examples: [
      "Como faço para tirar o atestado de residência (juminhyo)?",
      "O que devo fazer se perder meu cartão My Number?",
      "Onde estrangeiros podem pedir orientação sobre a vida no Japão?",
    ],
    supportButton: "Buscar programas de apoio para mim",
    supportNote:
      "Responda a algumas perguntas e mostraremos benefícios, auxílios, reduções de taxas e balcões de atendimento que você pode usar.",
    supportStart: "Quero encontrar programas de apoio que eu possa usar.",
    you: "Você",
    error: "Erro",
    typing: "Escrevendo a resposta…",
    inputLabel: "Mensagem",
    placeholder: "Digite uma mensagem",
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
