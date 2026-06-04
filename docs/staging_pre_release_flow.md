# 本番反映前の staging 確認フロー

- 対象: `しけん準備室 知財3級対策`
- 目的: 本番反映前に、文言・導線・購入状態の見え方を staging で揃えて確認する

## 使いどころ

次のような変更を本番に出す前に使います。

- CTA や導線の変更
- ログインまわりの変更
- プレミアム版の表示変更
- 購入状態の表示変更
- 問い合わせ / 法務 / 購入案内の文言変更

## 基本の流れ

1. `site` の staging 用公開物を作る
2. staging Worker を最新化する
3. staging Pages へ反映する
4. 画面確認を順番に行う
5. OK なら本番反映準備へ進む

## 1. staging 用公開物を作る

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ
powershell -ExecutionPolicy Bypass -File .\site\prepare_pages_dev_release.ps1 -EnvironmentName staging
```

## 2. staging Worker を更新する

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy --env staging
```

## 3. staging Pages を更新する

- staging 用 Pages プロジェクトへ最新の `site` を反映する
- 必要なら Git 連携のデプロイ完了を待つ

## 4. 確認の順番

### A. まず未ログイン状態で見る

- `/`
- `/app/`
- `/premium/`
- `/premium/ready/`
- `/login/`

見ること:

- `無料診断` と `無料版` が先に見える
- プレミアム版の案内が強すぎない
- ログイン前の説明が自然
- 開発用の文言が残っていない

### B. 次にログイン済み未購入で見る

- `/app/`
- `/premium/ready/`

見ること:

- `購入前の確認へ進む` が自然に出る
- `購入可能 / まだ受付前` の状態が環境設定どおり見える
- 無料版のままでも使い続けられる説明がある

### C. 最後に購入済み相当で見る

- `/app/`

見ること:

- プレミアム版の機能説明が無料版より分かりやすい
- `購入後の案内` が不自然でない
- `おすすめ`, `カテゴリ別学習`, `直前14日モード`
  の使い分けが見える

## 5. 変更ごとの確認メモ

### 文言変更のとき

- 利用者向けの言葉になっているか
- `LP`, `Worker`, `D1`, `stub` など制作側の言葉が残っていないか

### 導線変更のとき

- `次に押すボタン` が1つに絞れているか
- 無料版から見たときに迷いが増えていないか

### 購入まわり変更のとき

- staging で `purchaseEnabled: false` なら購入可能に見えないか
- staging で `purchaseEnabled: true` にする場合は、購入前 / 購入後の戻り先が自然か

## 6. 確認結果の残し方

最低限、次を残します。

- 確認した日付
- 確認した環境
- 見たページ
- 問題なし / 修正あり
- 修正が必要なら対象ファイル

短いメモ例:

```text
2026-06-04 staging
- /app/: OK
- /premium/ready/: ボタン文言が強いので修正
- /login/: OK
```

## 7. 本番へ進めてよい条件

- staging で主要ページの文言が揃っている
- 無料版からの導線が自然
- プレミアム版の価値説明が不自然でない
- 購入状態の見え方が意図どおり
- 開発用 / 内部向けの表現が残っていない

この条件が揃ってから、本番の `runtime-config.production.json` や Worker 本番設定の更新へ進みます。
