# Claude Software Factory

Issue に `ready` ラベルを付けるだけで、Claude が実装 → PR 作成 → 自動レビュー → 承認 → マージまで行います。

ワークフロー: [`.github/workflows/claude-factory.yml`](../.github/workflows/claude-factory.yml)

## 流れ

```
Issue に `ready` ラベル
  └─ implement ジョブ
       ├─ Issue に `claude-working` ラベル + 着手コメント
       ├─ Claude Code が Issue を読んで実装（テストも実行）
       ├─ ブランチ `claude/issue-<番号>` に push、PR 作成（Closes #<番号>）
       └─ 要件が曖昧なら PR を作らず Issue に質問 + `needs-human`
  └─ review-and-merge ジョブ
       ├─ 別の Claude が差分をレビューし APPROVE / REQUEST_CHANGES を判定
       ├─ APPROVE → PR を承認し squash マージ（auto-merge 有効なら CI 通過後）
       └─ REQUEST_CHANGES → 変更要求レビュー + Issue に `needs-human`
```

やり直したいときは `ready` ラベルを外して付け直せば、同じブランチ / PR を上書きして再実行します。

## セットアップ

1. **Secrets** (Settings → Secrets and variables → Actions)
   - `ANTHROPIC_API_KEY`（必須）
   - `FACTORY_GH_TOKEN`（推奨）: PR を作成・マージする用の Fine-grained PAT または GitHub App トークン
     - 権限: Contents / Pull requests / Issues を Read and write
     - これが無いと `GITHUB_TOKEN` で PR を作ることになり、
       (a) PR で CI ワークフローが起動しない、(b) 作成者と承認者が同じ bot になり承認できない、という制限が出ます。
2. **Actions の設定** (Settings → Actions → General)
   - Workflow permissions:「Allow GitHub Actions to create and approve pull requests」を ON
3. **（任意）auto-merge**: Settings → General →「Allow auto-merge」を ON にし、ブランチ保護で必須 CI を設定すると、CI が通ってからマージされます。
4. `ready` ラベルを作成（`claude-working` / `needs-human` は初回実行時に自動作成）

```bash
gh label create ready --color 0E8A16 --description "Claude に実装を任せる" -R team-mirai/mirai-gbot
```

## 安全面の注意

- ラベルを付けられるのは Triage 以上の権限を持つメンバーだけなので、起動できる人は限定されます。ただし Issue 本文はそのまま Claude に渡るので、外部の人が書いた Issue に `ready` を付ける前に本文を確認してください（プロンプトインジェクション対策）。
- Claude には push 権限を渡していません（checkout は `persist-credentials: false`）。commit / push / PR 作成はワークフローのシェルステップが行います。
- `.github/workflows/` への変更は自動で破棄されます。
- 自動レビューで `REQUEST_CHANGES` になった場合や、エラー時は `needs-human` ラベルで人間に戻します。
