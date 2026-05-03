# Public / Private Architecture

## 目的

Cloudflare Pages には公開してよい導線だけを置き、有料問題やライセンス判定は別のサーバー側で処理する。

## 公開側

- LP
- 記事
- 無料診断
- 無料体験版 UI
- 公開可能な価格表と商品説明
- public API への読み取りクライアント

## 非公開側

- 決済処理
- ライセンス判定
- 購入済みユーザー識別
- 有料問題パック
- 購入後配信 URL / manifest
- 秘密鍵、Webhook secret、課金プロバイダ設定

## 推奨レイヤー

1. Cloudflare Pages
   - `site/` をそのまま公開
   - LP、記事、無料診断、無料体験版だけを配信
2. public API
   - 無料問題
   - 公開カタログ
   - 診断結果の軽い補助
3. secure API
   - ログイン済みユーザーのライセンス確認
   - 購入済みパック manifest の返却
   - 必要な問題だけの配信
   - JWT は Supabase Auth 前提で検証する
   - 返却の中心は `active_plan` と `purchase_state`
   - 実装雛形は `secure_api_worker/` に分離して置く
4. private storage
   - 有料問題 JSON
   - 購入後配信用 bundle
5. private database
   - ユーザー
   - 注文
   - ライセンス
   - 配信ログ

## データフロー

1. ユーザーは Pages 上の LP / 診断 / 記事 / 無料体験版を見る
2. 無料体験版は public API から無料問題と公開カタログだけ取得する
3. 購入後またはログイン後の画面は secure API にアクセストークンを送る
4. secure API がライセンス状態を確認し、許可された問題パック manifest だけ返す
5. フロントは manifest に基づいて必要な問題だけ取得する

## リポジトリ分離

- public repo
  - `site/`
  - 公開可能な UI
  - 公開 API の型定義や契約書
  - 無料問題の最小データ
- private repo
  - secure API 実装
  - 決済連携
  - ライセンス判定
  - 有料問題パック
  - 非公開運用スクリプト
  - Cloudflare Workers へ持っていく secure API 雛形の発展版

## Cloudflare での置き場所の例

- Pages
  - LP、記事、無料診断、無料体験版
- Workers / Pages Functions
  - API 実装
- Supabase Auth
  - ログイン
  - セッション
  - JWT 発行
  - ローカル確認中は `local_stub` で同じ導線を再現する
- D1
  - 注文、ライセンス、配信状態
- R2
  - 有料問題 bundle、manifest
- Secrets
  - 決済鍵、署名鍵、外部 API キー
