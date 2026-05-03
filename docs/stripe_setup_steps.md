# Stripe セットアップ手順

この手順は、今の `local_stub` 決済を Stripe の買い切り決済へ差し替えるための順番です。

## 0. 商品方針

- 商品名: `3級プレミアム版`
- 価格: `1,200円`
- 形式: 買い切り
- 表示文言: `追加月額料金なし`

## 1. Stripe で商品を作る

Stripe Dashboard で:

1. `Product catalog`
2. `Create product`
3. 名前を `3級プレミアム版` にする

## 2. Price を作る

作成時の設定:

- `One-time`
- `JPY`
- `1200`

作成後に `price_...` の `Price ID` を控える。

## 3. Worker に Stripe 用 secret を入れる

Cloudflare Worker 側に必要:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- 必要なら `STRIPE_PRICE_ID`
- 必要なら `STRIPE_PRODUCT_NAME`
- `PUBLIC_SITE_URL`

ローカル `.dev.vars` にも同じキー名で入れる。

対象ファイル:

- [secure_api_worker/.dev.vars.example](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\.dev.vars.example)

## 4. checkout provider を切り替える

対象:

- [site/src/assets/runtime-config.ts](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\src\assets\runtime-config.ts)

変更:

- `checkoutProvider: "stripe"`
- `stripePriceId`

## 5. checkout/start を本実装に差し替える

いまの Worker は次を行う:

- `billing_catalog` で `stripe_product_id / stripe_price_id` を再利用
- `STRIPE_PRICE_ID` が未設定なら Stripe API で product と default price を自動作成
- `checkout.session` を作成
- `orders` に `provider_checkout_id` を保存

次にやること:

- Cloudflare 側へ更新後の Worker を再デプロイする
- `content_admin/schema.sql` の `billing_catalog` を D1 に反映する
- `PUBLIC_SITE_URL` を本番 URL にする
- `checkoutProvider` を `stripe` に切り替える

作成する Checkout Session には、`success_url / cancel_url / metadata` を付ける

最低限 metadata に入れたいもの:

- `auth_user_id`
- `plan_code`
- `product_code`

## 6. webhook を登録する

Stripe Dashboard で:

1. `Developers`
2. `Webhooks`
3. `Add endpoint`

URL:

- `https://<your-worker>/api/secure/billing/webhook`

イベント候補:

- `checkout.session.completed`
- 必要なら `payment_intent.succeeded`

## 7. webhook 署名を検証する

本番では `Stripe-Signature` を検証する。  
Stripe は webhook 署名検証を推奨している。

参考:

- [Checkout Sessions](https://docs.stripe.com/payments/checkout-sessions)
- [Webhook signatures](https://docs.stripe.com/webhooks/signatures)

## 8. 購入後に DB を更新する

webhook 成功時にやること:

1. `orders` を `paid`
2. `entitlements` に `premium`
3. `license/status` が `active_plan: premium` を返す

## 8.5. D1 に追加テーブルを反映する

`billing_catalog` を追加したので、D1 に再適用する。

対象:

- [content_admin/schema.sql](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin\schema.sql)

## 9. 最終確認

- 未購入で `/premium/ready/`
- 購入開始
- Stripe checkout
- 成功後 return
- `/app/` でプレミアム解放
- 再ログイン後も維持される

## 10. 返金時の運用

返金が必要になった場合は、Stripe 上で返金したあとに D1 の `orders / entitlements` も整理します。

参照:

- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md)
