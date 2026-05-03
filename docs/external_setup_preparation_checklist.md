# 外部サービス接続前の準備チェックリスト

- 作成日: 2026-04-30
- 対象: `site` を本番公開し、プレミアム版まで含めて動かすための事前準備

## 結論

いまの段階で、こちらの実装を次へ進めるためにユーザー側で用意が必要なのは主に次の4系統です。

1. Cloudflare Pages / Workers の公開先
2. Supabase Auth の接続先
3. 決済サービスの接続先
4. 公開時に表示する事業者・問い合わせ情報

## 1. Cloudflare 側で用意するもの

最低限:

- Cloudflare アカウント
- Pages 用のプロジェクト
- 将来 secure API を置く Workers / Functions の利用前提

あると進めやすいもの:

- 本番ドメイン
- 公開用サブドメイン
  - 例: `example.com`
  - 例: `secure.example.com`

こちらが後で設定に使う値:

- Pages の公開先 URL
- secure API の base URL

## 2. Supabase 側で用意するもの

最低限:

- Supabase プロジェクト
- `Project URL`
- `Publishable key`

設定しておく項目:

- メールログインを使うかどうか
- ログイン後のリダイレクト URL
  - `/login/`
  - `/premium/ready/`
  - `/app/`

こちらが後で設定に使う値:

- `supabaseUrl`
- `supabasePublishableKey`

参照:

- [site/SUPABASE_SETUP.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\SUPABASE_SETUP.md)

## 3. 決済サービス側で用意するもの

最低限:

- 利用する決済サービスのアカウント
- 商品 1 件
  - `3級プレミアム版`
- 価格 1 件
  - `1,200円`

あとで必要になるもの:

- 商品コード
  - 例: `grade3_premium`
- price / checkout に使う ID
- Webhook 用の秘密値

備考:

- ローカルではすでに `購入中 -> 購入完了 -> 権利付与` の流れを擬似再現できる
- ただし本番決済接続には実サービスの ID と webhook 設定が必要

## 4. 公開時の表示情報

最低限:

- 問い合わせ先メールアドレス
- 表示名
- 特商法ページに載せる事業者情報
- 返金方針の案

すでにページはある:

- [site/legal/index.html](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\legal\index.html)
- [site/terms/index.html](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\terms\index.html)
- [site/privacy/index.html](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\privacy\index.html)

ただし中身の最終値はユーザー側で決める必要がある。

## 5. すぐには不要なもの

今すぐなくても進められる:

- 本番ドメイン未取得
- 2級向け商品
- プレミアム問題の最終全量

つまり、まずは `3級プレミアム版 1商品` に必要な外部接続だけあればよい。

## 6. こちらが次に進められる条件

次のどちらかがあれば、その先を具体実装できる。

### パターンA

- Supabase の `Project URL`
- `Publishable key`

これがあれば:

- `site` の `local_stub` を `Supabase Auth` へ差し替える作業に入れる

### パターンB

- まだ外部キーは未取得

この場合でも:

- `.env` / runtime config の受け皿
- secure API の本番用インターフェース整理
- legal / terms / privacy の文言整理

までは先に進められる

## 7. 優先順位

一番先に欲しいもの:

1. Supabase の `Project URL` と `Publishable key`
2. 問い合わせ先メールアドレス
3. 決済サービスを何にするか

この3つが決まると、本番接続への実装をかなり前へ進めやすい。
