# Supabase 設定手順

- 作成日: 2026-04-30
- 対象: 知財検定学習アプリ
- 目的: `site` を `Supabase Auth` に接続するために、Supabase 側で何を設定するかを固定する

## 先に結論

このアプリでまず必要なのは次の4つです。

1. Supabase Project を作る
2. `Project URL`
3. `Publishable key`
4. Auth の `Site URL` と `Redirect URLs`

補足:

- `anon key` は legacy 扱い
- 今は `Publishable key` を使うのが推奨

## 手順 1. Supabase Project を作る

1. Supabase にログイン
2. `New project` を作成
3. Project 名を決める
   - 例: `chizai-kentei-app`
4. Database password を設定
5. Region を選ぶ
6. 作成完了まで待つ

## 手順 2. `Project URL` と `Publishable key` を取得する

### いちばん簡単な場所

1. 対象 Project を開く
2. `Connect` を開く
3. `Project URL` を控える
4. `Publishable key` を控える

### `anon key` を見たい場合

1. `Settings`
2. `API Keys`
3. `Legacy API Keys`
4. `anon` を確認

ただし、このアプリで入れる値としては `Publishable key` のほうを推奨します。

## 手順 3. Auth の URL を設定する

1. `Authentication`
2. `URL Configuration`
3. `Site URL` を設定
4. `Redirect URLs` に必要な URL を追加

### ローカル確認用に入れたい値

- `http://127.0.0.1:8780/`
- `http://127.0.0.1:8780/login/`
- `http://127.0.0.1:8780/premium/ready/`
- `http://127.0.0.1:8780/app/`

### 将来の本番用に入れたい値

- `https://あなたの本番ドメイン/`
- `https://あなたの本番ドメイン/login/`
- `https://あなたの本番ドメイン/premium/ready/`
- `https://あなたの本番ドメイン/app/`

## 手順 4. ログイン方式を決める

### まずおすすめ

最初は `メールログイン` が一番シンプルです。

確認したい場所:

1. `Authentication`
2. `Sign In / Providers`
3. `Email`

ここで見る項目:

- Email ログインを有効にするか
- Confirm email を有効にするか

### 最初のおすすめ設定

- Email: 有効
- Confirm email:
  - ローカルで早く確認したいなら `OFF`
  - 本番寄りで進めたいなら `ON`

使い分け:

- `OFF`
  - その場で登録とログイン確認を進めやすい
- `ON`
  - 本番に近い導線を早めに確認できる
  - その場合は、確認メールのリンクを一度開いてからログインする

## 手順 5. GitHub ログインを使いたい場合

GitHub ログインを使うなら、Supabase だけでは完結しません。GitHub 側の OAuth App も必要です。

1. GitHub で OAuth App を作る
2. `Client ID` と `Client Secret` を取得
3. Supabase の
   - `Authentication`
   - `Sign In / Providers`
   - `GitHub`
   に入れる

この段階では、まず Email ログインから始めて、あとで GitHub を足すほうが安全です。

## 手順 6. こちらに渡してほしい値

最低限この2つがあれば、こちらで実装を進められます。

1. `Project URL`
2. `Publishable key`

あると次まで進めやすいもの:

3. どのログイン方式にするか
   - まずは Email
   - もしくは GitHub

## 手順 7. このあとこちらがやること

値がそろったら、こちらで次を進めます。

1. `site` の `runtime-config` に接続点を追加
2. `local_stub` を `Supabase Auth` に差し替え
3. `/login/` の実ログイン化
4. `secure API` に token を送る接続へ変更

## 参考

- [Supabase Docs: API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Docs: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Docs: Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)
