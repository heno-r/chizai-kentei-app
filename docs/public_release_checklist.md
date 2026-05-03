# 公開前チェックリスト

- 最終更新: 2026-05-03
- 補足: Stripe Sandbox で購入成功した同一ユーザーは、`D1` の `entitlements` により再ログイン後もプレミアム版になります
- 補足: 未購入状態の再確認は、新しいテスト用メールアドレスか `orders / entitlements` のリセットで行う

## 画面

- [x] `/`
- [x] `/diagnosis/`
- [x] `/app/`
- [x] `/premium/`
- [x] `/premium/ready/`
- [x] `/login/`
- [x] `/contact/`
- [x] `/terms/`
- [x] `/privacy/`
- [x] `/legal/`

## 無料版

- [x] 無料版で `grade3_mixed_priority_50` の 50問が表示される
- [x] 未ログインでも無料版を解ける
- [x] 問題数、出題セット、要復習件数の表示が自然

## ログイン

- [x] 新規登録
- [x] ログイン
- [x] ログアウト
- [x] ログイン後に `/premium/ready/` へ戻れる

## プレミアム状態

- [x] `license/status` が `premium` を返す
- [x] `/app/` でプレミアム機能ロックが外れる
- [x] プレミアム問題未登録でも `無料50問 + 追加0問` と見える
- [x] プレミアム問題登録後に `無料50問 + 追加N問` になる

## 決済導線

- [x] `購入手続きに進む`
- [x] `購入後の状態を試す`
- [x] 価格表示 `3級プレミアム版 1,200円 / 追加月額料金なし`

## 運用

- [x] `review_tool` から publish 条件を確認できる
- [x] `content_admin/debug_content_db.py` で公開 / 非公開セットを確認できる
- [x] `premium_plan_registry.json` に登録した set_id が manifest に出る
- [x] 返金時に `Stripe -> D1 -> 無料版へ戻る` の流れを確認できる
- [x] `review_tool` から本番問い合わせの確認と状態更新ができる

## 残りの優先確認

- [x] `/contact/` の送信確認を行う
- [x] `/terms/`, `/privacy/`, `/legal/` を実画面で最終確認する
- [x] プレミアム問題セット登録後に追加分が混ざることを確認する
- [x] `review_tool` と `debug_content_db.py` の運用確認を 1 回通す
- [x] [docs/service_naming_guidance.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\service_naming_guidance.md) に沿って公開名を確定する
- [x] [docs/refund_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md) に返金時の内部運用手順をまとめる
- [x] [docs/contact_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md) に問い合わせ対応手順をまとめる

## 固定ページの補足

- [x] [docs/legal_page_fill_items.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\legal_page_fill_items.md) の必須項目を埋める
