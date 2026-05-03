# お問い合わせ対応手順

`/contact/` から送られた問い合わせは、Cloudflare D1 の `contact_messages` に保存されます。  
現在は `review_tool` から本番問い合わせを直接見て、`new / in_progress / done` を更新する運用です。

## 1. 事前準備

- Worker 側に `ADMIN_API_TOKEN` を設定する
- ローカルに [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\contact_viewer_config.local.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\contact_viewer_config.local.json) を置く
- `admin_token` は Worker 側と同じ値にする

## 2. 問い合わせ一覧を開く

1. [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\run_review_tool.bat](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\run_review_tool.bat) を起動
2. 上部の `本番問い合わせ` を押す
3. 一覧から対象の問い合わせを選ぶ

確認できる項目:

- 名前
- 返信先メールアドレス
- 本文
- 送信元ページ
- User-Agent
- 受信日時
- 更新日時
- 対応状態

## 3. 対応状態を更新する

問い合わせを選んだ状態で、上部のボタンから更新します。

- `未対応へ戻す`
  - `new`
- `対応中`
  - `in_progress`
- `対応済み`
  - `done`

目安:

- `new`
  - まだ確認していない
- `in_progress`
  - 内容確認中、返信待ち、返金処理中など
- `done`
  - 返信または対応が完了した

## 4. 返信時の運用

- 一般問い合わせ
  - 内容を確認して通常返信
- 返金依頼
  - [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md) に従う
- 個人情報の開示、訂正、削除依頼
  - `/privacy/` の案内に沿って対応する

## 5. 見えないときの確認先

- `本番問い合わせ` が空
  - 本番 D1 に保存されているか
- `HTTP 403`
  - `ADMIN_API_TOKEN` が一致しているか
- `Error 1010`
  - Cloudflare 側で bot 判定されていないか
- `admin access is not configured`
  - Worker 側に `ADMIN_API_TOKEN` が未設定

## 6. 補足

- `DBビューア` の `ローカル問い合わせ` はローカル SQLite 用
- 本番問い合わせは `本番問い合わせ` ボタンから見る
