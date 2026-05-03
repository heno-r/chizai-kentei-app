# System Architecture

## 目的

知財検定アプリを、公開導線と有料機能を安全に分離した構成で育てる。

## 採用方針

- 公開サイトは Cloudflare Pages
- 有料機能は secure API 側で制御
- 認証はできるだけ自前実装せず SaaS を利用
- 問題データは `free` と `paid` を物理的に分離
- public repo には公開してよいコードだけを置く

## 推奨スタック

### 公開層

- Cloudflare Pages
  - LP
  - 記事
  - 無料診断
  - 無料体験版

### 認証

- 採用方針: Supabase Auth
- 代替候補: Clerk / Firebase Auth

Supabase Auth を採用方針にする理由:

- 無料枠が大きい
- JWT ベースで Cloudflare Workers と相性がよい
- パスワード再発行、メール認証などを自前で抱えなくてよい
- `site` 側の購入前導線にログイン導線を置きやすい

想定する初期フロー:

1. 無料版を試す
2. `購入前チェック` でログイン導線を見る
3. Supabase Auth でログイン
4. 購入または購入済み確認
5. secure API が JWT を検証してプレミアム機能を返す

### 非公開 API

- Cloudflare Workers または Pages Functions
  - ライセンス確認
  - 購入済み判定
  - 有料問題 manifest の返却
  - 必要な問題だけの配信

### データ

- D1
  - users
  - orders
  - entitlements
  - delivery_logs

- R2
  - paid question packs
  - manifest
  - 非公開JSON

## レイヤー図

```text
User
  -> Cloudflare Pages
    -> LP / 記事 / 無料診断 / 無料体験版
  -> Public API
    -> 無料問題 / 公開カタログ
  -> Secure API
    -> JWT検証
    -> ライセンス確認
    -> 有料問題の必要分だけ返却
      -> D1
      -> R2
      -> 決済連携
```

## セキュリティ境界

### public repo に置いてよいもの

- `site/`
- 無料問題の最小セット
- 公開UI
- 公開APIの契約書
- 商品説明、価格表

### public repo に置かないもの

- 有料問題本文
- レビュー途中の問題束
- 決済秘密情報
- Webhook secret
- ライセンス判定の内部実装
- 購入済みユーザーデータ

## 運用ルール

1. 無料問題は `site/app/data/questions.json` に限定する
2. 有料問題は public repo にコピーしない
3. クライアントは有料問題の全量を持たない
4. secure API は毎回 JWT と entitlement を確認する
5. 決済 webhook は署名検証する
6. 秘密情報は Cloudflare Secrets に置く

補足:

- ローカル確認用の secure API は、現在 `sub` / `email` / `iss` / `exp` の確認までを担当
- JWT 署名の本格検証は、本番の private secure API 実装側で行う

## 現時点の判断

- 公開/非公開分離の方向性は妥当
- 本番運用では `Supabase Auth` を前提に進める
- コストと安全性のバランスは `Supabase Auth + Workers + D1 + R2` が最有力
