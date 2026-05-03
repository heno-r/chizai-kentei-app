# Stripe / Cloudflare 実行コマンド

このメモは、今の `secure_api_worker/` と `site/` を前提に、
そのまま順番に実行しやすい形でまとめたものです。

## 1. D1 に最新 schema を反映する

`billing_catalog` を追加したので、まず D1 に schema を再適用します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --file=..\content_admin\schema.sql
```

もし D1 の名前が違うなら、`chizai-kentei-license` の部分だけ置き換えます。

確認:

```powershell
npx wrangler d1 execute chizai-kentei-license --remote --command="PRAGMA table_list;"
```

## 2. Worker の vars を `wrangler.toml` に入れる

[secure_api_worker/wrangler.toml.example](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\wrangler.toml.example)
をコピーして `wrangler.toml` を作り、少なくとも次を埋めます。

- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWKS_URL`
- `SUPABASE_EXPECTED_AUDIENCE`
- `PREMIUM_PLAN_CODE`
- `PREMIUM_PRODUCT_CODE`
- `PREMIUM_PRICE_JPY`
- `APP_ENTRY_PATH`
- `PUBLIC_SITE_URL`
- `STRIPE_PRODUCT_NAME`
- `PREMIUM_PLAN_REGISTRY_JSON`
- `database_id`
- `bucket_name`

`PUBLIC_SITE_URL` は本番の Pages URL を入れます。  
ローカル確認中だけなら `http://127.0.0.1:8780` でも構いません。

## 3. Worker secrets を入れる

Stripe の秘密情報は `wrangler secret put` で入れます。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

必要ならこれも入れます。

```powershell
npx wrangler secret put STRIPE_PRICE_ID
```

値は repo に書かず、Stripe Dashboard から取得したものを貼り付けます。

- `STRIPE_SECRET_KEY`: `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...`
- `STRIPE_PRICE_ID`: `price_...`

## 4. Worker を再デプロイする

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy
```

デプロイ後、次を確認します。

```powershell
curl https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev/api/secure/health
```

## 5. Stripe Dashboard で webhook を作る

Stripe Dashboard で:

1. `Developers`
2. `Webhooks`
3. `Add endpoint`

Endpoint URL:

```text
https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev/api/secure/billing/webhook
```

イベントは最低限これです。

- `checkout.session.completed`

余裕があればこれも追加します。

- `checkout.session.expired`

作成後に `whsec_...` を控えて、`STRIPE_WEBHOOK_SECRET` に入れます。

## 6. `site` を Stripe モードに切り替える

[site/src/assets/runtime-config.ts](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\src\assets\runtime-config.ts)
で、次を変えます。

```ts
checkoutProvider: "stripe",
stripePriceId: "price_xxx",
supportEmail: "your-support@example.com",
```

そのあと build します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
.\quiz_app\node_modules\.bin\tsc.cmd -p .\site\tsconfig.json
Copy-Item -Force .\site\build\app\auth-client.js .\site\app\auth-client.js
Copy-Item -Force .\site\build\premium\purchase-ready-page.js .\site\premium\purchase-ready-page.js
Copy-Item -Force .\site\build\app\app.js .\site\app\app.js
```

## 7. Stripe の最初の課金確認は Sandbox で行う

最初は `test mode / sandbox` で行います。実際のお金は動きません。

確認の流れ:

1. `http://127.0.0.1:8780/login/`
2. ログイン
3. `http://127.0.0.1:8780/premium/ready/`
4. `購入手続きに進む`
5. Stripe Checkout へ移動
6. テストカードで決済完了
7. `/app/` へ戻り、プレミアム版解放を確認

## 8. Stripe の Sandbox で使う主な値

利用者向け入力では、Stripe のテストカードを使います。  
カード番号などは Stripe の公式テスト値を使います。

参考:

- [Testing use cases](https://docs.stripe.com/test-mode)
- [Test card numbers](https://docs.stripe.com/testing?testing-method=payment-methods)
- [Webhook signatures](https://docs.stripe.com/webhooks/signatures)

## 9. テスト購入後に同じユーザーを無料版へ戻したいとき

Sandbox 購入が成功すると、D1 の `entitlements` にプレミアム権限が残ります。
そのため、同じユーザーは次回もプレミアム版として扱われます。

詳しい戻し方は次を参照してください。

- [docs/stripe_test_user_reset_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\stripe_test_user_reset_steps.md)

