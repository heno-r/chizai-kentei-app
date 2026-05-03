# Site Publish Layout

Cloudflare Pages に載せる公開用ディレクトリです。ここには LP、記事、無料診断、無料体験版だけを置きます。

## 公開レイヤー

- `index.html`
  - LP
- `diagnosis/index.html`
  - 無料診断
- `premium/index.html`
  - 3級プレミアム版の案内ページ
- `premium/ready/index.html`
  - 3級プレミアム版の購入前チェックページ
- `login/index.html`
  - ログイン状態と購入状態の確認ページ
- `terms/index.html`
  - 利用規約
- `privacy/index.html`
  - プライバシーポリシー
- `legal/index.html`
  - 特定商取引法に基づく表記
- `articles/chizai-kentei-3kyu-1month/index.html`
  - 集客記事
- `app/`
  - 無料体験版
- `assets/`
  - 公開用の共通アセット

## 非公開レイヤーに置くもの

- 有料問題データ
- 課金判定
- ライセンス状態
- 購入後配信
- 決済 Webhook と秘密情報

## Cloudflare Pages の設定

- Framework preset: `None`
- Build command: 空欄、または必要なら `exit 0`
- Build output directory: `site`

## ローカル確認

- [run_site.bat](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\run_site.bat)
  - 公開サイト一式をローカルで確認するための起動バッチ
  - 起動後の確認先:
    - `http://127.0.0.1:8780/`
    - `http://127.0.0.1:8780/app/`
    - `http://127.0.0.1:8780/premium/`
    - `http://127.0.0.1:8780/premium/ready/`
    - `http://127.0.0.1:8780/login/`

## API 前提の運用

- Pages 側は静的公開と無料導線に限定する
- 公開フロントは public API から無料問題や公開カタログだけ取得する
- 有料版は secure API がライセンス確認後に必要分だけ返す
- public repo には公開してよいコードだけを載せる
- 公開訴求は `無料版で試す -> プレミアム版で仕上げる` の2段構成に寄せる
- 公開スクリプトの正本は `site/src/` の TypeScript に置き、生成物を `site/app/`, `site/assets/`, `site/premium/` に反映する

## 参考ドキュメント

- `ARCHITECTURE.md`
- `API_CONTRACT.md`
- `PUBLIC_REPO_POLICY.md`
- `SUPABASE_SETUP.md`
- `../secure_api_worker/README.md`
- `../docs/premium_set_registration_rules.md`
- `../docs/public_release_checklist.md`
