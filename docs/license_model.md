# ライセンスモデル設計

- 作成日: 2026-04-30
- 対象: 知財検定アプリ 3級プレミアム版
- 前提: 認証は `Supabase Auth`、配信APIは `Cloudflare Workers + D1 + R2`

## 目的

プレミアム版の購入状態を安全に管理し、`free / premium` の表示切替と問題配信判定を一貫して行えるようにする。

## 最小データモデル

### `users`

認証済みユーザーの基本情報を持つ。

想定カラム:

- `id`
  - アプリ内部のユーザーID
- `auth_provider`
  - 例: `supabase`
- `auth_user_id`
  - Supabase 側のユーザーID
- `email`
- `display_name`
- `created_at`
- `updated_at`
- `last_login_at`
- `status`
  - `active`, `suspended`

### `orders`

決済単位の履歴を持つ。

想定カラム:

- `id`
- `user_id`
- `product_code`
  - 例: `grade3_premium`
- `price_jpy`
- `currency`
  - 例: `JPY`
- `payment_provider`
  - 例: `stripe`
- `provider_checkout_id`
- `provider_payment_id`
- `order_status`
  - `initiated`, `pending`, `paid`, `failed`, `refunded`, `cancelled`
- `purchased_at`
- `created_at`
- `updated_at`

### `entitlements`

実際に何を使えるかの権利テーブル。  
フロント側の `free / premium` 切替は、このテーブルを最終ソースとする。

想定カラム:

- `id`
- `user_id`
- `plan_code`
  - `free`, `premium`
- `product_code`
  - 例: `grade3_premium`
- `scope_type`
  - `plan`, `question_set`
- `scope_id`
  - 例: `grade3_mixed_priority_50`, `grade3_premium_main`
- `status`
  - `active`, `revoked`, `expired`
- `granted_at`
- `expires_at`
  - 買い切り想定では通常 `NULL`
- `source_order_id`
- `updated_at`

## 推奨する権利設計

### 基本方針

- 無料版は匿名でも使える
- プレミアム版はログイン後に権利を確認する
- `orders` は購入履歴
- `entitlements` は現在有効な権利

### 3級プレミアム版の扱い

おすすめは次の2段です。

1. `plan_code = premium`
2. `scope_id` で問題セット単位の権利も持てるようにする

これで将来、

- 3級プレミアム版
- 2級プレミアム版
- 特定の模試セット

のような切り分けにも耐えやすい。

## 例

### 無料ユーザー

- `orders`: なし
- `entitlements`: なし
- フロント表示: `free`

### 3級プレミアム版購入ユーザー

- `orders`
  - `product_code = grade3_premium`
  - `order_status = paid`
- `entitlements`
  - `plan_code = premium`
  - `scope_type = plan`
  - `scope_id = grade3_premium`
  - `status = active`

必要なら追加で:

- `scope_type = question_set`
- `scope_id = grade3_premium_main`

## API で返したい最小情報

`GET /secure/license/status`

```json
{
  "user_id": "user_123",
  "signed_in": true,
  "active_plan": "premium",
  "entitlements": [
    {
      "plan_code": "premium",
      "scope_type": "plan",
      "scope_id": "grade3_premium",
      "status": "active",
      "granted_at": "2026-05-10T10:00:00Z",
      "expires_at": null
    }
  ]
}
```

## フロントでの使い方

- 未ログイン
  - `free` 表示
- ログイン済み、権利なし
  - `free` 表示
- ログイン済み、`premium` 権利あり
  - `premium` 表示
- 問題セット取得時
  - secure API が `entitlements` を確認して返却範囲を決める

## 今の実装へつなぐポイント

- `site/src/app/app.ts`
  - 将来 `active_plan` を受けて無料版/プレミアム版の表示を切り替える
- `quiz_app/src/app.ts`
  - ローカル試作では固定だが、本番では同じ `active_plan` 前提に寄せる
- `review_tool` / `content_admin`
  - `required_plan` は配信対象の最低条件として使い続ける

## いま決めておく結論

- 認証済みユーザー管理は `users`
- 購入履歴は `orders`
- 利用権判定は `entitlements`
- フロントの最終判定キーは `active_plan`
- 買い切りなので `expires_at` は原則 `NULL`
