# Supabase Auth 接続メモ

- 作成日: 2026-04-30
- 対象: `site/` のログイン導線を `local_stub` から `Supabase Auth` に差し替える準備

## いまの前提

- 現在の `site` はローカル確認用に `local_stub` 方式で動く
- 実際の本番では `Supabase Auth` を使う
- secure API 側は `Authorization: Bearer <token>` を受けてライセンスを判定する

## 差し替えポイント

### 1. runtime config

対象:

- [site/src/assets/runtime-config.ts](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\src\assets\runtime-config.ts)

本番で追加したい設定例:

```ts
window.APP_RUNTIME_CONFIG = Object.freeze({
  publicApiBaseUrl: "https://example.com",
  secureApiBaseUrl: "https://secure.example.com",
  authMode: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "YOUR_PUBLISHABLE_KEY",
  loginPath: "/login/",
});
```

### 2. auth client

対象:

- [site/src/app/auth-client.ts](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\src\app\auth-client.ts)

いまは:

- `local-free-session`
- `local-premium-session`

を localStorage に入れて secure API スタブへ送っている。

本番では:

- Supabase SDK でログイン
- access token を取得
- `fetchLicenseStatus()` で secure API に送る

形へ差し替える。

### 3. secure API

対象:

- private repo 側の secure API

必要なこと:

- Supabase JWT の検証
- `auth_user_id` と `users / entitlements` の照合
- `active_plan`
- `purchase_state`

の返却

ローカルの現状:

- `sub` を `auth_user_id` として使う
- `email` / `name` が取れれば `users` 同期に使う
- `exp` と `iss` は local secure API で確認する
- ただし JWT 署名の本格検証は、private repo 側の本番 secure API で入れる

## 最低限ほしい本番エンドポイント

- `GET /api/secure/license/status`
- `POST /api/secure/billing/checkout/start`
- `POST /api/secure/billing/webhook`
- `GET /api/secure/premium/manifest`

## 確認順

1. Supabase でメールログインが通る
2. `site/login/` からログイン状態が取れる
3. `license/status` が `active_plan` を返す
4. `/app/` のロック状態が切り替わる
5. `/premium/ready/` の購入導線と戻り先が自然につながる
6. local secure API で `exp` / `iss` の不正 token を弾ける

## 補足

- Supabase の Connect 画面に出る Next.js 用の `@supabase/ssr` 手順は、この `site/` にはそのまま使わない
- このプロジェクトでは静的サイトとして `@supabase/supabase-js` のブラウザクライアントだけを利用する
- フロントへ置くのは `Publishable key` で、`service_role key` は置かない
