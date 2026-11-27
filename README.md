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
- モデル: 既定は `openai/gpt-6-luna`（安価なモデル。入力 $0.10 / 出力 $0.50 per 1M tokens）。環境変数 `OPENROUTER_MODEL` で変更できます
- Web 検索: OpenRouter のモデル名に `:online` を付けて呼び出し、最新情報を検索した上で回答します。参照したページは回答末尾に出典として表示されます。`OPENROUTER_WEB_SEARCH=false` で無効化できます（検索 1 回あたり追加コストがかかります）
