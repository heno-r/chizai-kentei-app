# Stripe テスト購入ユーザーのリセット手順

Sandbox で 1 回購入したユーザーは、`entitlements` に権限が残るため、
次回ログイン時もプレミアム版として扱われます。

これはキャッシュではなく、`D1` に保存された購入権限による正常な挙動です。

未購入状態をもう一度確認したいときは、次のどちらかを使います。

## 方法 1. 新しいテスト用メールアドレスで確認する

いちばん安全です。既存の購入履歴を壊しません。

1. [http://127.0.0.1:8780/login/](http://127.0.0.1:8780/login/) を開く
2. 新しいメールアドレスでアカウントを作成する
3. そのユーザーで無料版状態を確認する

## 方法 2. D1 から対象ユーザーの購入状態を消す

同じユーザーで Sandbox 購入を何度も試したいときに使います。

### 2-1. まず対象ユーザーを見つける

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --command="SELECT id, auth_user_id, email, display_name, status, created_at, updated_at, last_login_at FROM users ORDER BY updated_at DESC LIMIT 20;"
```

`auth_user_id` または `email` を確認します。

### 2-2. 対象ユーザーの購入権限を削除する

次の SQL の `REPLACE_AUTH_USER_ID` を実際の値に置き換えて実行します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --command="DELETE FROM entitlements WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = 'REPLACE_AUTH_USER_ID'); DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = 'REPLACE_AUTH_USER_ID');"
```

### 2-3. リセット後に確認する

1. [http://127.0.0.1:8780/app/](http://127.0.0.1:8780/app/) を開く
2. 一度 `ログアウト` する
3. 同じユーザーで再ログインする
4. 無料版状態に戻っていることを確認する

## 補足

- `users` テーブル自体は残す前提です
- 削除するのは `orders` と `entitlements` だけです
- Sandbox の再確認用途なので、本番ユーザーには使わないでください
- `--file` で `Authentication error [code: 10000]` が出る場合は、`--command` を使ってください
