# mirai-gbot

Next.js (App Router) + TypeScript のシンプルなチャットボット。[OpenRouter](https://openrouter.ai/) 経由で Claude を呼び出します。Vercel にそのままデプロイできます。

## ローカルで動かす

```bash
cp .env.example .env.local   # OPENROUTER_API_KEY を記入
npm install
npm run dev
```

http://localhost:3000 を開きます。

## Vercel にデプロイ

1. Vercel ダッシュボードで **Add New → Project** からこの GitHub リポジトリを Import
2. Framework Preset は自動で **Next.js** になります（設定変更不要）
3. **Environment Variables** に `OPENROUTER_API_KEY` を追加
4. **Deploy**

以降は `main` への push で本番、PR ごとにプレビューが自動デプロイされます。

## 構成

- `app/page.tsx` — チャット画面（クライアントコンポーネント）
- `app/useSpeechRecognition.ts` — ブラウザの Web Speech API による日本語の音声入力。対応ブラウザ（Chrome・Edge・Safari など）でのみ入力欄にマイクボタンが表示されます
- `app/api/chat/route.ts` — OpenRouter の Chat Completions API を呼び出し、テキストをストリーミング返却
- モデル: 既定は `openai/gpt-6-luna`（安価なモデル。入力 $0.10 / 出力 $0.50 per 1M tokens）。環境変数 `OPENROUTER_MODEL` で変更できます
- Web 検索: OpenRouter の web プラグインで最新情報を検索した上で回答します。検索対象は政府・自治体の公式ドメイン（`go.jp` / `lg.jp` とそのサブドメイン）だけに限定しており、それ以外のサイトは検索・出典表示の対象になりません。対象ドメインは `SEARCH_ALLOWED_DOMAINS`（カンマ区切り）で変更できます。参照したページは回答末尾に出典として表示されます。`OPENROUTER_WEB_SEARCH=false` で無効化できます（検索 1 回あたり追加コストがかかります）

## セキュリティ

アプリ側で行っている対策:

- `/api/chat` の入力検証: 文字列以外の content を拒否、1 メッセージ 2000 文字・履歴 20 件・本文 64KB まで
- IP ごとの簡易レート制限（既定 10 回/分、`RATE_LIMIT_PER_MINUTE` で変更、0 で無効）
- 他サイトからのブラウザ経由の呼び出し（`Sec-Fetch-Site: cross-site` / Origin 不一致）を拒否
- OpenRouter のエラー詳細はクライアントに返さずサーバーログのみに出す
- OpenRouter に `provider.data_collection: "deny"` を指定し、入力を学習・保存するプロバイダーを使わない
- CSP・`X-Frame-Options`・HSTS などのセキュリティヘッダー（`next.config.ts`）
- Markdown 表示は innerHTML を使わず、リンクは http(s)/mailto のみ許可

運用側で設定してください（コードでは防ぎきれないもの）:

- **OpenRouter の API キーに利用上限（クレジット上限）を設定**する。`/api/chat` は認証なしの公開エンドポイントなので、上限が最後の砦になります
- **Vercel Firewall でレート制限ルールを追加**する（例: `/api/chat` に IP あたり 10 回/分）。アプリ内のレート制限はインスタンスごとのメモリなので完全ではありません
- 必要なら Vercel の Bot Protection / Attack Challenge Mode を有効にする

## 自動開発（Claude Software Factory）

Issue に `ready` ラベルを付けると、Claude が自動で実装 → PR 作成 → レビュー → マージまで行います。コンフリクトした PR も Claude が自動で解決します。仕組みとセットアップ手順は [docs/software-factory.md](docs/software-factory.md) を参照してください。

## ライセンス

[GNU Affero General Public License v3.0 or later](LICENSE)（AGPL-3.0-or-later）で公開しています。

AGPL のため、このソフトウェアを改変してネットワーク越しにサービスとして提供する場合は、利用者に対して改変後のソースコードを入手できる手段を提供する必要があります。
