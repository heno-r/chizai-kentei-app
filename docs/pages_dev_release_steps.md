# `pages.dev` で正式公開する手順

この手順は、`site` を Cloudflare Pages に公開し、

- `*.pages.dev` を本番 URL として使う
- Supabase ログイン
- Stripe 決済
- secure API Worker

をつなぐための最短手順です。

## 0. 最初に確認すること

利用者に見せる公開 URL は `Pages` 側に寄せます。

- 正しい公開フロント URL の例
  - `https://shiken-junbishitsu-chizai3.pages.dev`
- secure API Worker の URL の例
  - `https://chizai-kentei-secure-api.<account-subdomain>.workers.dev`

もし `https://<name>.<account-subdomain>.workers.dev` が出ているなら、それは `Worker` 側の URL です。  
このままでも動作確認はできますが、利用者向けの正式公開 URL としては `Pages` を別で作る前提で進めます。

## 1. Pages プロジェクトを作る

Cloudflare Dashboard で次を開きます。

1. `Workers & Pages`
2. `Create application`
3. `Pages`
4. `Connect to Git`

対象リポジトリを選びます。

## 2. Build 設定を入れる

このプロジェクトの `site` は静的サイトです。Cloudflare Pages では次で始めるのが分かりやすいです。

- Production branch: `main`
- Root directory: `site`
- Build command: `exit 0`
- Build output directory: `.`

補足:

- `site` 自体が配信物なので、出力先は `.` で扱います
- Cloudflare Pages の docs でも、静的 HTML では `exit 0` を build command にする形が案内されています

## 3. `pages.dev` の URL を控える

初回デプロイ後に、

- `https://<project-name>.pages.dev`

の URL が付きます。

例:

- `https://shiken-junbishitsu-chizai3.pages.dev`

## 4. Worker の `PUBLIC_SITE_URL` を本番 URL にする

`secure_api_worker` が

- Stripe の `success_url`
- `cancel_url`
- アプリへの戻り先

を組み立てるので、Cloudflare Worker 側の `PUBLIC_SITE_URL` を `pages.dev` に変えます。

例:

- `PUBLIC_SITE_URL = https://shiken-junbishitsu-chizai3.pages.dev`

変更後は Worker を再デプロイします。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy
```

## 5. Supabase に `pages.dev` を追加する

Supabase Dashboard で次を開きます。

1. `Authentication`
2. `URL Configuration`

ここに本番 URL を入れます。

- Site URL
- Redirect URLs

最低限入れる候補:

- `https://<project-name>.pages.dev/`
- `https://<project-name>.pages.dev/login/`
- `https://<project-name>.pages.dev/premium/ready/`
- `https://<project-name>.pages.dev/app/`

## 6. Stripe の戻り先を確認する

今回の構成では、Stripe の戻り先は Worker 側の `PUBLIC_SITE_URL` をもとに組み立てます。

確認したいこと:

- `success_url` が `pages.dev` に戻る
- `cancel_url` が `pages.dev` に戻る
- Webhook endpoint は Worker URL のままでよい

Webhook 例:

- `https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev/api/secure/billing/webhook`

## 7. Pages 本番 URL で通し確認する

最低限この順で確認します。

1. `/`
2. `/app/`
3. `/login/`
4. `/premium/`
5. `/premium/ready/`
6. `/contact/`
7. `/terms/`
8. `/privacy/`
9. `/legal/`

## 8. 無料版の確認

- 未ログインで無料 50 問が見える
- 解説と参考 URL が見える
- プレミアム版への入口が分かる

## 9. ログインと購入の確認

Sandbox のままで次を通します。

1. 新規登録
2. ログイン
3. `購入前チェックへ進む`
4. `購入手続きに進む`
5. Stripe Checkout
6. `/app/` に戻る
7. プレミアム解放

## 10. ログアウト確認

- ログアウト後に無料版へ戻る
- 別アカウントでも導線が壊れない

## 11. 問い合わせフォーム確認

- `/contact/` から送信できる
- `contact_messages` に保存される

## 12. 公開直前に決めること

- Stripe を test のままにするか、本番へ切り替えるか
- `/terms/` の施行日
- 必要なら準拠法と管轄裁判所
- 問い合わせ確認の運用頻度

## 12.5. 本番値を repo 本体へ直書きしたくないとき

`supportEmail` や Stripe の公開値は、次のローカル上書きファイルでも差し込めます。

- [site/config/runtime-config.production.local.example.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\config\runtime-config.production.local.example.json)

使い方:

1. `site/config/runtime-config.production.local.example.json` をコピー
2. `site/config/runtime-config.production.local.json` を作る
3. `stripePublishableKey`, `stripePriceId`, `supportEmail` を入れる
4. `render_runtime_config.ps1` または `prepare_pages_dev_release.ps1` を実行する

`runtime-config.production.local.json` は `.gitignore` 対象です。

## 13. 本番切替の直前チェック

先にこの確認を回すと、不足設定をまとめて拾えます。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\scripts\validate_staging_setup.ps1 -EnvironmentName production
```

- Worker の `PUBLIC_SITE_URL` は `pages.dev`
- Supabase の Redirect URL は `pages.dev`
- Stripe の Price / webhook は使う環境と一致
- `premium-questions/<set_id>.json` は R2 にある
- Pages の最新デプロイが反映されている
