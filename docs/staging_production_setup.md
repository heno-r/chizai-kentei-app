# ステージング / 本番 環境の切り分け

このリポジトリでは、`site` と `secure_api_worker` をそれぞれ

- `production`
- `staging`

の2系統で切り替えられるようにします。

## 1. Pages 側の設定

`site/config/` に環境ごとの設定ファイルを置きます。

- [site/config/runtime-config.production.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.json)
- [site/config/runtime-config.staging.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.staging.json)
- 必要なら `site/config/runtime-config.production.local.json`
  - ひな形: [site/config/runtime-config.production.local.example.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.local.example.json)
  - Stripe の公開値や問い合わせ先をローカル上書きで差し込めます

`runtimeConfig` の中に、公開フロントが参照する値をまとめます。

主に分けるもの:

- `secureApiBaseUrl`
- `cloudflarePagesProject`
- `purchaseEnabled`
- `supabaseUrl`
- `supabasePublishableKey`

`pagesUrl` はリリース補助スクリプトが参照します。

## 2. runtime-config の生成

公開物へ反映する前に、環境ごとの JSON から `runtime-config.js` を生成します。

- [site/render_runtime_config.ps1](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\render_runtime_config.ps1)

例:

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site
powershell -ExecutionPolicy Bypass -File .\render_runtime_config.ps1 -EnvironmentName production
powershell -ExecutionPolicy Bypass -File .\render_runtime_config.ps1 -EnvironmentName staging
```

## 3. Pages 用リリース補助

[site/prepare_pages_dev_release.ps1](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\prepare_pages_dev_release.ps1)
は `-EnvironmentName` を受け取れるようにしています。

例:

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\site\prepare_pages_dev_release.ps1 -EnvironmentName production
powershell -ExecutionPolicy Bypass -File .\site\prepare_pages_dev_release.ps1 -EnvironmentName staging
```

## 4. ローカル確認

[site/run_site.bat](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\run_site.bat)
は第1引数で環境を選べます。

```bat
site\run_site.bat production
site\run_site.bat staging
```

引数なしなら `production` 扱いです。

## 5. Worker 側の切り分け

[secure_api_worker/wrangler.toml](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\wrangler.toml)
では:

- ルート: 本番
- `[env.staging]`: ステージング

として扱います。

本番:

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy
```

ステージング:

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy --env staging
```

## 6. 先に埋めるべき値

ステージング用には少なくとも次を実値へ変更します。

- `site/config/runtime-config.staging.json`
  - `pagesUrl`
  - `runtimeConfig.secureApiBaseUrl`
  - `runtimeConfig.supabaseUrl`
  - `runtimeConfig.supabasePublishableKey`
- `secure_api_worker/wrangler.toml`
  - `[env.staging.vars].SUPABASE_PROJECT_URL`
  - `[env.staging.vars].SUPABASE_JWKS_URL`
  - `[env.staging.vars].PUBLIC_SITE_URL`
  - `[[env.staging.d1_databases]]`
  - `[[env.staging.r2_buckets]]`

埋め終わったかの確認には、次のチェックを使えます。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\scripts\validate_staging_setup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\validate_staging_setup.ps1 -EnvironmentName production
```

- 引数なし: `staging`
- `-EnvironmentName production`: 本番設定の不足確認

## 7. 運用の考え方

- `main` + 本番 Pages + 本番 Worker を本番系
- `staging` 用 Pages プロジェクト + `wrangler --env staging` を検証系
- Stripe は staging では `test` を維持
- `purchaseEnabled` は staging で必要になるまで `false` でもよい

## 8. staging で購入導線を止めたまま確認するとき

購入受付をまだ開けない段階では、次の手順書を使います。

- [docs/staging_purchase_disabled_checklist.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\staging_purchase_disabled_checklist.md)

このチェックでは、`purchaseEnabled: false` のまま

- `/app/`
- `/premium/`
- `/premium/ready/`
- `/login/`

の見え方が不自然でないかを確認します。

## 9. 本番反映前に staging で文言・導線確認するとき

購入受付の有無にかかわらず、本番へ出す前に staging で全体の文言と導線を確認するときは次を使います。

- [docs/staging_pre_release_flow.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\staging_pre_release_flow.md)

このフローでは、

- 未ログイン
- ログイン済み未購入
- 購入済み相当

の順でページを見て、導線と文言の違和感を潰します。
