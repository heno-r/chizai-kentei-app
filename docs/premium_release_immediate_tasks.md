# プレミアム版公開に向けた直近実装タスク

## 目的

今のコードベースから、プレミアム版まで含めて公開できる状態へ進めるための「今すぐ着手する実装」を順番付きで固定する。

---

## Phase 1: 無料版公開の足場を固める

### 1. 無料公開セットを確定する

- 状態: 2026-04-30 時点で完了
- 確定セット: `grade3_mixed_priority_50`
- 参照: `docs/free_public_set_decision.md`

- `shared_content` から無料版に入れる問題を 20〜30問に確定する
- `content_admin` で無料セット用 `set_id` を固定する
- `review_tool` から無料セットを publish できる状態にする

対象:

- `shared_content/`
- `review_tool/review_gui.py`
- `content_admin/publish_approved_questions.py`

完了条件:

- 無料版として出す `set_id` が 1 つ決まっている
- `site/app/` からそのセットを読める

### 2. `site/app` の本番用確認

- 状態: 2026-04-30 時点で完了
- 参照: `docs/site_public_display_checklist.md`

- `site/run_site.bat` で公開ルートを確認する
- `/`
- `/diagnosis/`
- `/app/`
- `/premium/`
- `/premium/ready/`

確認項目:

- 文言が利用者向けになっている
- 価格表記が `追加月額料金なし` 付きで揃っている
- 2級が前面に出ていない
- 無料版からプレミアム版への導線が自然

対象:

- `site/index.html`
- `site/diagnosis/index.html`
- `site/app/index.html`
- `site/premium/index.html`
- `site/premium/ready/index.html`

完了条件:

- 公開画面の表示確認メモが作れる

---

## Phase 2: 本番 public API の置き換え準備

### 3. public API の契約を固定する

- 状態: 2026-04-30 時点で完了
- 参照: `site/API_CONTRACT.md`

実装前に、最低限この 2 本だけを固定する。

- `GET /api/public/catalog`
- `GET /api/public/questions?set_id=...`

やること:

- 実レスポンス例を docs に残す
- エラー時レスポンスも決める
- `site/app` と `quiz_app` で共通前提にする

対象:

- `site/API_CONTRACT.md`
- `site/src/app/api-client.ts`
- `quiz_app/src/services/question-repository.ts`

完了条件:

- フロント側が「どんな JSON が返るか」を決め打ちできる

### 4. API ベースURLの切替点を整理する

- 状態: 2026-04-30 時点で完了
- 参照: `site/src/assets/runtime-config.ts`

やること:

- `site` の runtime config を本番差し替えしやすくする
- `quiz_app` はローカル API を使い続ける
- `site` は将来の public API URL に切り替えられるようにする

対象:

- `site/src/assets/runtime-config.ts`
- `site/src/app/api-client.ts`

完了条件:

- 本番URLを差し替える場所が 1 箇所にまとまっている

---

## Phase 3: 認証の受け皿を作る

### 5. 認証方式を固定する

- 状態: 2026-04-30 時点で完了
- 採用方針: `Supabase Auth`
- 参照: `docs/system_architecture.md`

第一候補:

- `Supabase Auth`

決めること:

- メールログインにするか
- パスワード方式にするか
- ログイン後にどの画面へ戻すか

対象:

- `docs/system_architecture.md`
- `site/ARCHITECTURE.md`

完了条件:

- 認証基盤が 1 つに決まる

### 6. フロントのログイン導線を置く

- 状態: 2026-04-30 時点で完了
- 参照: `site/premium/ready/index.html`

やること:

- `site/premium/ready/` にログイン案内プレースホルダーを置く
- 未ログイン時の購入前導線を明示する
- 将来の `ログインして続ける` ボタン位置を固定する

対象:

- `site/premium/ready/index.html`
- `site/src/premium/purchase-ready-page.ts`

完了条件:

- 購入前ページから次にどこへ進むかが見える

---

## Phase 4: 決済・ライセンス管理の土台

### 7. ライセンス用データモデルを決める

- 状態: 2026-04-30 時点で完了
- 参照: `docs/license_model.md`

最低限必要:

- `users`
- `orders`
- `entitlements`

決めること:

- `free` / `premium`
- 購入日時
- 有効状態
- 問題セットごとの閲覧権

対象:

- `docs/system_architecture.md`
- 新規 `docs/license_model.md`

完了条件:

- バックエンド実装前に必要カラムが決まっている

### 8. 決済完了後の状態遷移を決める

- 状態: 2026-04-30 時点で完了
- 参照: `docs/purchase_flow.md`

やること:

- 未購入
- 購入中
- 購入成功
- ライセンス反映済み

の 4 段階を決める

対象:

- `site/premium/ready/index.html`
- `site/src/premium/purchase-ready-page.ts`
- 新規 `docs/purchase_flow.md`

完了条件:

- 購入後にどこへ戻るかが決まっている

---

## Phase 5: プレミアム問題配信の接続

### 9. プレミアムセットを publish できるようにする

- 状態: 2026-04-30 時点で完了
- 参照: `review_tool/review_gui.py`, `content_admin/debug_content_db.py`

やること:

- `required_plan = premium` のセットを本番前提で整理する
- 無料セットと混ざらないようにする
- `question_sets` に説明文と用途タグを揃える

対象:

- `review_tool/review_gui.py`
- `content_admin/publisher.py`
- `content_admin/debug_content_db.py`

完了条件:

- `free` セットと `premium` セットが見分けられる

### 10. フロントのプラン状態を実ライセンス連動へ寄せる

- 状態: 2026-04-30 時点で完了
- 参照: `quiz_app/src/services/plan-status.ts`

今は:

- 手動または固定表示

今後:

- ライセンス状態に応じて `free / premium` が決まる

対象:

- `site/src/app/app.ts`
- `quiz_app/src/app.ts`

完了条件:

- プラン状態の取得元を差し替えやすい

---

## Phase 6: 公開前の法務・安心材料

### 11. 購入前ページに最低限の安心材料を入れる

- 状態: 2026-04-30 時点で完了
- 参照: `site/premium/ready/index.html`

追加したい項目:

- 問い合わせ先
- 返金可否
- 対応端末
- オンライン前提
- 追加月額料金なし

対象:

- `site/premium/ready/index.html`

完了条件:

- 購入前に不安になる情報が一通り見える

### 12. 公開に必要な固定ページを作る

- 状態: 2026-04-30 時点で完了
- 参照: `site/terms/`, `site/privacy/`, `site/legal/`

必要候補:

- 利用規約
- プライバシーポリシー
- 特定商取引法に基づく表記

対象:

- `site/terms/`
- `site/privacy/`
- `site/legal/`

完了条件:

- 購入導線の公開に必要な固定ページがある

---

## 最初の 1 週間でやる順番

### Day 1-2

- 無料公開セット確定
- `site` の画面最終確認

### Day 3

- public API 契約固定
- runtime config 整理

### Day 4

- 認証方式決定
- 購入前ページにログイン導線プレースホルダー追加

### Day 5

- ライセンスモデル設計
- 購入フロー設計メモ作成

### Day 6-7

- プレミアムセット publish 方針確定
- 法務ページの雛形作成

---

## 直近の実装着手おすすめ順

1. 無料公開セットの確定
2. `site` の画面最終確認
3. `public API` 契約固定
4. 認証方式決定
5. 購入前ページのログイン導線
6. ライセンスモデル設計
7. 法務ページ雛形

---

## 外部準備

- 参照: `docs/external_setup_preparation_checklist.md`
- 本番接続に入る前に、`Supabase Project URL / Publishable key`、問い合わせ先メール、決済サービス方針の3つを優先して揃える

---

## Phase 7: 本番 secure API への移行準備

### 13. Cloudflare Workers 雛形を分離する

- 状態: 2026-05-01 時点で完了
- 参照: `secure_api_worker/README.md`

やること:

- `site/` とは別フォルダに secure API 雛形を置く
- `license/status`
- `premium/manifest`
- `premium/questions`
- `billing/checkout/start`
- `billing/webhook`

完了条件:

- 本番で Pages と secure API を別デプロイできる構成になっている

### 14. プレミアム問題セット registry を固定する

- 状態: 2026-05-01 時点で完了
- 参照: `docs/premium_set_registration_rules.md`

やること:

- `base_public_set_id`
- `merge_strategy`
- `question_sets`

を設定ファイルとして持つ

完了条件:

- premium 問題を登録した瞬間に `/app/` へ自然に混ぜ込める
