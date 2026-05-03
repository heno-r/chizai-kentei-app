# Cloudflare Worker セットアップ手順

この手順は [secure_api_worker](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker) を本番へ近づけるための、実作業順メモです。

## 0. 先に用意するもの

- Cloudflare アカウント
- Supabase Project URL
- Supabase Publishable key
- 後で使う Stripe アカウント

## 1. D1 を作る

Cloudflare Dashboard で:

1. `Workers & Pages`
2. `D1`
3. `Create database`
4. 名前は `chizai-kentei-license` を推奨

作成後に `database_id` を控える。

## 2. R2 を作る

Cloudflare Dashboard で:

1. `R2`
2. `Create bucket`
3. 名前は `chizai-kentei-premium-content` を推奨

このバケットには後で:

- `premium-questions/<set_id>.json`

を置く。

## 3. Worker プロジェクト設定を作る

1. [secure_api_worker/wrangler.toml.example](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\wrangler.toml.example) をコピーして `wrangler.toml` を作る
2. 次を埋める

- `name`
- `database_id`
- `bucket_name`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWKS_URL`
- `PREMIUM_PLAN_REGISTRY_JSON`

`PREMIUM_PLAN_REGISTRY_JSON` の中身は [content_admin/premium_plan_registry.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin\premium_plan_registry.json) と意味を揃える。

## 4. ローカル secrets を置く

1. [secure_api_worker/.dev.vars.example](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\.dev.vars.example) をコピーして `.dev.vars` を作る
2. 最低限この値を確認する

- `SUPABASE_PROJECT_URL`
- `SUPABASE_JWKS_URL`
- `SUPABASE_EXPECTED_AUDIENCE`
- `PREMIUM_PLAN_CODE`
- `PREMIUM_PRODUCT_CODE`
- `PREMIUM_PRICE_JPY`
- `APP_ENTRY_PATH`
- `PREMIUM_PLAN_REGISTRY_JSON`

Stripe をまだ使わないなら:

- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`

は空欄でもよい。

## 5. D1 に schema を入れる

Workers 本番側でも DB 構造は [content_admin/schema.sql](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin\schema.sql) と揃える。

実行イメージ:

```powershell
wrangler d1 execute chizai-kentei-license --file ..\content_admin\schema.sql
```

## 6. Worker をローカル確認する

`secure_api_worker` ディレクトリで:

```powershell
wrangler dev
```

確認するエンドポイント:

- `/api/secure/health`
- `/api/secure/license/status`
- `/api/secure/premium/manifest`

## 7. Worker をデプロイする

```powershell
wrangler deploy
```

デプロイ後の Worker URL を控える。

## 8. site 側に本番 secure API URL を入れる

対象:

- [site/src/assets/runtime-config.ts](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\src\assets\runtime-config.ts)

変更する値:

- `secureApiBaseUrl`
- 将来は `checkoutProvider`

## 9. 動作確認

順番:

1. `/login/`
2. `/premium/ready/`
3. `/app/`

見る点:

- ログインできる
- `license/status` が取れる
- プレミアム状態で機能が解放される

## 10. Stripe に進む前の完了条件

- D1 と R2 の binding が動く
- Worker が deploy できる
- `site` が Worker の `secureApiBaseUrl` を見に行ける
- ローカル stub に依存しなくてもプレミアム状態の確認ができる
