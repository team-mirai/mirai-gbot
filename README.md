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
