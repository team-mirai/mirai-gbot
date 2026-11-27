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
- `app/privacy/page.tsx` — 利用上の注意とプライバシー（入力内容の扱い・個人情報入力の注意・免責）の説明ページ。チャット画面のヘッダーと入力欄下の注意書きからリンク
- `app/api/chat/route.ts` — OpenRouter の Chat Completions API を呼び出し、テキストをストリーミング返却
- モデル: 既定は `anthropic/claude-opus-5.5`。環境変数 `OPENROUTER_MODEL` で変更できます
- Web 検索: OpenRouter のモデル名に `:online` を付けて呼び出し、最新情報を検索した上で回答します。参照したページは回答末尾に出典として表示されます。`OPENROUTER_WEB_SEARCH=false` で無効化できます（検索 1 回あたり追加コストがかかります）

## 自動開発（Claude Software Factory）

Issue に `ready` ラベルを付けると、Claude が自動で実装 → PR 作成 → レビュー → マージまで行います。仕組みとセットアップ手順は [docs/software-factory.md](docs/software-factory.md) を参照してください。

## ライセンス

[GNU Affero General Public License v3.0 or later](LICENSE)（AGPL-3.0-or-later）で公開しています。

AGPL のため、このソフトウェアを改変してネットワーク越しにサービスとして提供する場合は、利用者に対して改変後のソースコードを入手できる手段を提供する必要があります。
