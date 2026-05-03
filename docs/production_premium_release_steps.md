# プレミアム問題セットを本番へ上げる手順

この手順は、`grade3_premium_combined_160` を例に、

- ローカル配信用 DB
- Cloudflare Worker / D1 / R2
- Cloudflare Pages 上の `site`

へ反映する順番をまとめたものです。

## 1. ローカル DB に publish する

いまのレビュー結果を `content.db` に反映します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin
powershell -ExecutionPolicy Bypass -File .\publish_grade3_premium_combined_160.ps1
```

確認ポイント:

- `grade3_premium_combined_160` が DB ビューアに出る
- `required_plan = premium`
- `visibility = private`

## 2. R2 用の JSON を書き出す

Worker 本番は `PREMIUM_CONTENT` バケットからプレミアム問題を読むので、配信用 JSON を出力します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin
powershell -ExecutionPolicy Bypass -File .\export_grade3_premium_combined_160_for_r2.ps1
```

出力先:

- `content_admin\deploy_artifacts\premium-questions\grade3_premium_combined_160.json`

## 3. R2 にアップロードする

`secure_api_worker` で使っている R2 バケットへ配置します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler r2 object put chizai-kentei-premium-content/premium-questions/grade3_premium_combined_160.json --file ..\content_admin\deploy_artifacts\premium-questions\grade3_premium_combined_160.json
```

補足:

- `chizai-kentei-premium-content` は実際のバケット名に合わせる
- object key は Worker 実装に合わせて `premium-questions/<set_id>.json`

## 4. registry を確認する

`grade3_premium_combined_160` が `premium_plan_registry.json` に入っていることを確認します。

対象:

- `content_admin\premium_plan_registry.json`
- Worker の `PREMIUM_PLAN_REGISTRY_JSON`

今の前提では、`grade3_premium_combined_160` はすでに登録済みです。

## 5. Worker の変数を更新する

Cloudflare Dashboard で、必要なら最新の `PREMIUM_PLAN_REGISTRY_JSON` を入れ直します。

更新後は Worker を再デプロイします。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy
```

## 6. Pages / site 側で確認する

ローカル確認:

1. `site\run_site.bat` を起動
2. プレミアム購入済みユーザーでログイン
3. `/app/` を開く

確認ポイント:

- `無料50問 + 追加N問` になる
- `question_count` が増える
- 追加問題にも解説、参考URLが出る

## 7. 本番確認

本番 Pages URL で次を確認します。

1. 未購入ユーザーでは無料50問のまま
2. 購入済みユーザーでは `premium/manifest` が `grade3_premium_combined_160` を返す
3. `premium/questions?set_id=grade3_premium_combined_160` が `200`
4. `/app/` で無料50問に追加問題が混ざる
