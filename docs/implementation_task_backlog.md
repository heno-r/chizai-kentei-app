# 実装タスクバックログ

- 最終更新: 2026-06-04
- 対象: `しけん準備室 知財3級対策`
- 目的: これから実装・修正する内容を、`今やる順` と `後でやるもの` に分けて整理する

## いま最優先で残っていること

1. 本番の設定値を入れる
2. 本番 URL でログインから購入までを通し確認する
3. 問い合わせ運用を本番想定で 1 回通す
4. スマホ幅で主要ページの表示崩れを実機確認する

## いま見えている未設定

- `supportEmail`
- `stripePublishableKey`
- `stripePriceId`

補足:

- production の不足確認は [scripts/validate_staging_setup.ps1](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\scripts\validate_staging_setup.ps1) で確認できる
- `PUBLIC_SITE_URL` は [secure_api_worker/wrangler.toml](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\wrangler.toml) に反映済み
- ローカル上書きは [site/config/runtime-config.production.local.example.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.local.example.json) から作成できる

---

## P0 公開前に終わらせる

### 1. 本番設定

- [ ] `supportEmail` を実運用の問い合わせ先へ置き換える
  - 対象: [site/config/runtime-config.production.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.json)
- [ ] `stripePublishableKey` を本番値へ設定する
  - 対象: [site/config/runtime-config.production.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.json)
- [ ] `stripePriceId` を本番商品に合わせて設定する
  - 対象: [site/config/runtime-config.production.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.json)
- [ ] production 向けの preflight を通す
  - コマンド: `powershell -ExecutionPolicy Bypass -File .\scripts\validate_staging_setup.ps1 -EnvironmentName production`
- [ ] Pages 配信用ファイルを production で再生成する
  - コマンド: `powershell -ExecutionPolicy Bypass -File .\site\prepare_pages_dev_release.ps1 -EnvironmentName production`

### 2. 決済と配信

- [ ] premium payload を R2 にアップロードする
  - 参照: [docs/pages_dev_release_next_steps.txt](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\pages_dev_release_next_steps.txt)
- [ ] Worker を本番向けに再デプロイする
  - 対象: [secure_api_worker](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker)
- [ ] 本番 URL で `購入前の確認 -> Checkout -> /app/ 復帰 -> プレミアム解放` を確認する
  - 対象ページ: `/premium/ready/`, `/login/`, `/app/`

### 3. アカウント導線の確認

- [ ] 新規登録から無料版へ戻る流れを確認する
- [ ] ログイン済み未購入で `/premium/ready/` に戻れることを確認する
- [ ] 購入済みで `/app/` に戻ったときプレミアム機能が見えることを確認する
- [ ] パスワード再設定メール送信から再ログインまでを確認する

### 4. 法務と問い合わせ運用

- [ ] 法務ページの運営者表記と実運用情報が一致していることを確認する
  - 対象: `/terms/`, `/privacy/`, `/legal/`
- [ ] 問い合わせ送信と管理側確認を 1 セットで通す
  - 参照: [docs/contact_roundtrip_check.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_roundtrip_check.md)
- [ ] 問い合わせ返信フローを 1 回本番想定で通す
  - 補助: [review_tool/production_contact_admin_cli.py](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\production_contact_admin_cli.py)

---

## P1 公開直後までにやる

### 5. 画面と導線の実地確認

- [ ] 主要ページをスマホ幅で確認する
  - 対象: `/`, `/app/`, `/premium/`, `/premium/ready/`, `/login/`, `/contact/`
- [ ] `トップ -> 無料版 -> ログイン -> 購入前の確認` の遷移を実機で確認する
- [ ] 購入完了後の `/app/` 内案内が迷わず使えるかを確認する

### 6. 公開後の運用立ち上げ

- [ ] 問い合わせ確認の初回運用を回す
  - 参照: [docs/contact_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md)
- [ ] 公開直後 1 週間の確認項目を 1 回なぞる
  - 参照: [docs/launch_week_operations.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\launch_week_operations.md)
- [ ] リリース前後の最終チェックを更新する
  - 対象: [docs/public_release_checklist.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\public_release_checklist.md)

---

## P2 余裕が出たらやる改善

### 7. 学習体験

- [x] 学習履歴の見せ方を分かりやすくする
- [x] 苦手カテゴリの見せ方を、より直感的にする
- [x] プレミアム版で増える価値を `/app/` 内でも伝わりやすくする
- [x] 直前14日モードの説明を短くし、利用開始の敷居を下げる
- [x] 学習結果から次に解くべき 1 セットを、さらに自動提案できるようにする
- [x] プレミアム版の価値説明を `/app/` と `/premium/` でさらに揃える

### 8. コンテンツと記事導線

- [x] `著作権が苦手な人向け` の記事を追加する
- [x] `知財検定3級の勉強法` の入口記事を追加する
- [ ] 記事ページから無料診断と無料版への導線を AB 的に見直す

### 9. staging 整備

- [ ] staging 用 Supabase / Worker / Pages の実値を埋める
  - 参照: [docs/staging_production_setup.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\staging_production_setup.md)
- [x] staging 実値の不足を拾う確認スクリプトを追加する
- [x] staging で購入導線を止めた状態の確認手順を作る
- [x] 本番反映前に staging で文言・導線確認する運用を固める

---

## P3 中長期

### 10. 2級対応の準備

- [ ] 2級向けの問題セット設計を始める
- [ ] 2級のカテゴリ設計と表示名を整理する
- [ ] 2級を前面に出さずに準備を進められるデータ構造を整える
  - 対象: [site/app/data/public_catalog.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\app\data\public_catalog.json)

### 11. 配信運用の自動化

- [ ] 問題追加から R2 配信までの手順を半自動化する
- [ ] premium payload 更新の確認コマンドをまとめる
- [ ] 差し替え時に見るチェック項目をテンプレ化する

### 12. 指標と改善ループ

- [ ] 無料版開始数、ログイン数、購入前ページ到達数を見られるようにする
- [ ] どのページで離脱しやすいかを確認できるようにする
- [ ] よく押される CTA を見て導線改善へ反映する

---

## 直近 5 タスク

1. `runtime-config.production.local.json` を作って `supportEmail`, `stripePublishableKey`, `stripePriceId` を入れる
2. `validate_staging_setup.ps1 -EnvironmentName production` を通す
3. `prepare_pages_dev_release.ps1 -EnvironmentName production` を通す
4. Worker と Pages を本番向けに反映する
5. 本番 URL で `ログイン -> 購入 -> /app/` の通し確認をする

## 判断メモ

- まずは `3級` に集中する
- `2級` は準備を進めても、公開導線の主役にはまだしない
- 価値の中心は `問題数` より `苦手復習` と `直前対策`
- 直前の優先度は `新機能追加` より `設定`, `導線確認`, `運用確認`
