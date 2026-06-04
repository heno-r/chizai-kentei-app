# staging で購入導線を止めた状態の確認手順

- 対象: `しけん準備室 知財3級対策`
- 想定環境: `staging`
- 目的: 購入受付をまだ開けない段階で、公開向けの文言と導線が不自然になっていないかを確認する

## 前提

- `site/config/runtime-config.staging.json`
  - `purchaseEnabled: false`
  - `checkoutProvider: "stripe"`
- `secure_api_worker/wrangler.toml`
  - `[env.staging.vars].PURCHASE_ENABLED = "false"`
- staging 用 Pages / Worker / Supabase の実値が最低限入っている

## 事前準備

0. staging 実値がまだプレースホルダのまま残っていないか確認する

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\scripts\validate_staging_setup.ps1
```

1. staging 用の runtime config を生成する

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\site\prepare_pages_dev_release.ps1 -EnvironmentName staging
```

2. staging Worker をデプロイする

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy --env staging
```

3. staging 用の Pages 公開物を反映する

- Cloudflare Pages の staging プロジェクトへ最新の `site` を反映する

## 確認するページ

- `/`
- `/app/`
- `/premium/`
- `/premium/ready/`
- `/login/`

## 確認チェック

### 1. トップページ

- `購入` や `決済` を急かす見え方になっていない
- `無料診断` と `無料版` の導線が先に見える
- プレミアム案内が `内容確認` 寄りの文言になっている

### 2. 学習ページ `/app/`

- `次にやること` が `ログインして次へ進む` ではなく、必要に応じて `プレミアム版の内容を見る` へ寄る
- `プレミアム版で増えること` が見えていても、購入可能に見えすぎない
- `購入後の案内` セクションが、未購入ユーザーに不用意に出ない
- `直前14日モード` などのロック説明が `使えません` ではなく `プレミアム版で使えます` の案内になっている

### 3. プレミアム案内ページ `/premium/`

- 価格や機能説明は見える
- ただし `今すぐ購入できる` ような強い導線にはなっていない
- CTA が `内容を確認する` 寄りのままになっている

### 4. 購入前の確認ページ `/premium/ready/`

- ログイン前:
  - `まだログインしていません。今は内容確認と無料版の体験を続けられます。`
  - のような案内になっている
- ログイン後:
  - `今はプレミアム版の内容確認まで進めます。`
  - のような案内になっている
- ボタン:
  - `今は内容確認を進める`
  - になっていて、決済画面へ進まない

### 5. ログインページ `/login/`

- ログイン後の戻り先が staging の `/app/` or `/premium/ready/` で自然につながる
- ログインページに `local stub` や開発用の言い回しが出ていない

## 期待する挙動

- staging では、ログインや購入状況確認はできる
- ただし購入受付は開かない
- どの画面でも、利用者には `いまは内容確認の段階` と分かる
- `購入に失敗したように見える` のではなく、`まだ受付前` に見える

## 確認後に見るログ

- Worker ログに checkout start の呼び出しが不要に出ていない
- `/premium/ready/` でボタン押下時、公開向けの案内文になっている
- JS エラーでボタン無効化に失敗していない

## 差し戻しポイント

以下のどれかがあれば修正対象:

- `購入手続きに進む` のような購入可能前提の文言が残る
- 押すと決済画面へ遷移してしまう
- `Stripe`, `Worker`, `D1` など運営側の事情が画面に出る
- `今は内容確認を進める` より強い CTA が先頭に出る

## 本番反映前の扱い

- staging でこのチェックを通してから、本番側の `purchaseEnabled` を有効にする
- 本番で Stripe を開ける前に、文言・遷移・ロック表示が staging で揃っていることを確認する
