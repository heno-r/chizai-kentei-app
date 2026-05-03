# secure_api_worker

Cloudflare Workers 前提の secure API 雛形です。  
無料部分を載せる `site/` とは分けて、会員状態・購入状態・プレミアム問題配信だけを扱います。

## 目的

- `site/` から受け取る Supabase access token を検証する
- `license/status` で会員状態を返す
- `premium/manifest` と `premium/questions` でプレミアム配信を制御する
- `billing/checkout/start` と `billing/webhook` の入口を持つ

## 想定バインディング

- `LICENSE_DB`
  - Cloudflare D1
- `PREMIUM_CONTENT`
  - Cloudflare R2
- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWKS_URL`
- `SUPABASE_EXPECTED_AUDIENCE`
- `PREMIUM_PLAN_CODE`
- `PREMIUM_PRICE_JPY`
- `PREMIUM_PRODUCT_CODE`
- `APP_ENTRY_PATH`
- `PREMIUM_PLAN_REGISTRY_JSON`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_API_TOKEN`

## ルート

- `GET /api/secure/health`
- `GET /api/secure/license/status`
- `GET /api/secure/premium/manifest`
- `GET /api/secure/premium/questions?set_id=...`
- `GET /api/secure/admin/contact-messages`
- `POST /api/secure/billing/checkout/start`
- `POST /api/secure/billing/webhook`

## 使い方

1. `wrangler.toml.example` を元に `wrangler.toml` を作る
2. D1 / R2 / secrets を Cloudflare 側で設定する
3. `PREMIUM_PLAN_REGISTRY_JSON` には `content_admin/premium_plan_registry.json` と同じ意味の JSON を入れる
4. ローカルの `content_admin/local_api_server.py` で固めた契約に合わせて本番APIへ差し替える

詳しい手順:

- [docs/cloudflare_worker_setup_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\cloudflare_worker_setup_steps.md)
- [docs/stripe_setup_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\stripe_setup_steps.md)
- [docs/stripe_cloudflare_execution_commands.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\stripe_cloudflare_execution_commands.md)
- [docs/stripe_test_user_reset_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\stripe_test_user_reset_steps.md)

## 補足

- この雛形は public repo に置いてよいコードだけで構成しています
- 本番では Stripe や Supabase の秘密情報を repo に含めません
- 管理用の問い合わせ一覧を読むときは `ADMIN_API_TOKEN` を Worker とローカル設定の両方に入れます
- 購入完了後の entitlement 付与ロジックは webhook 側で実装する前提です
