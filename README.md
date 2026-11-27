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
- `app/api/chat/route.ts` — OpenRouter の Chat Completions API を呼び出し、テキストをストリーミング返却
- モデル: 既定は `anthropic/claude-opus-5.5`。環境変数 `OPENROUTER_MODEL` で変更できます
- Web 検索: OpenRouter のモデル名に `:online` を付けて呼び出し、最新情報を検索した上で回答します。参照したページは回答末尾に出典として表示されます。`OPENROUTER_WEB_SEARCH=false` で無効化できます（検索 1 回あたり追加コストがかかります）

## 不正利用・コスト対策

`/api/chat` は 1 回ごとに OpenRouter の従量課金が発生するため、次の制限を入れています（`app/api/chat/limits.ts`）。値は環境変数で変更でき、`0` で無効になります。

| 環境変数 | 既定値 | 内容 |
| --- | --- | --- |
| `RATE_LIMIT_PER_MINUTE` | 10 | IP あたり 1 分間のリクエスト上限。超えると 429 |
| `RATE_LIMIT_PER_DAY` | 100 | IP あたり 1 日のリクエスト上限。超えると 429 |
| `MAX_INPUT_CHARS` | 1000 | 1 メッセージの最大文字数。超えると 413 |
| `MAX_HISTORY_MESSAGES` | 20 | モデルに送る会話履歴の最大件数（古い分は切り捨て） |
| `MAX_HISTORY_CHARS` | 8000 | モデルに送る会話履歴の合計最大文字数（古い分は切り捨て） |

レート制限のカウンタはサーバーのメモリ上に持っているため、Vercel のように複数インスタンスで動く環境やコールドスタート後はカウントが分散・リセットされます。あくまで目安の上限なので、**確実な上限として OpenRouter 側でも利用上限を設定してください**。

### OpenRouter の利用上限を設定する

1. [OpenRouter の Keys ページ](https://openrouter.ai/settings/keys) で本番用の API キーを開き（または新しく作成し）、**Credit limit** に上限額（例: 月の予算）を設定する
2. 上限に達するとそのキーでのリクエストは失敗するので、ボットはエラーを返して止まり、それ以上は課金されない
3. 自動チャージ（Auto top-up）を使う場合は、チャージ額・上限も予算に合わせておく
4. [Activity ページ](https://openrouter.ai/activity) で利用状況を定期的に確認する

さらに強い対策が必要になった場合は、Vercel Firewall のレート制限ルールや Bot 対策（Attack Challenge Mode / BotID）、Cloudflare Turnstile の導入を検討してください。

## 自動開発（Claude Software Factory）

Issue に `ready` ラベルを付けると、Claude が自動で実装 → PR 作成 → レビュー → マージまで行います。仕組みとセットアップ手順は [docs/software-factory.md](docs/software-factory.md) を参照してください。

## ライセンス

[GNU Affero General Public License v3.0 or later](LICENSE)（AGPL-3.0-or-later）で公開しています。

AGPL のため、このソフトウェアを改変してネットワーク越しにサービスとして提供する場合は、利用者に対して改変後のソースコードを入手できる手段を提供する必要があります。
