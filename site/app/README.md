# Public Free App

Cloudflare Pages に載せる公開用の無料体験版です。

## 位置づけ

- `無料版`
  - 出題形式を試す
  - 基本論点を少し解いて感触をつかむ
- `プレミアム版`
  - 全問題
  - 苦手復習
  - 直前14日モード
  - 学習プラン

公開版アプリは、無料体験を見せつつプレミアム版の価値を案内する役割に寄せます。

## このディレクトリに置くもの

- 無料で見せてよい UI
- 無料問題の表示ロジック
- 公開可能な価格案内とプラン説明
- public API への読み取り口

## このディレクトリに置かないもの

- 有料問題本文
- ライセンス判定ロジック
- 購入後配信の実処理
- 課金トークン、秘密鍵、Webhook 秘密情報

## 構成

- `index.html`
  - 公開版の無料学習 UI
- `app.js`
  - 無料版の画面制御
- `api-client.js`
  - public API / secure API の呼び分け口
- `data/questions.json`
  - 公開してよい無料問題だけ
- `data/public_catalog.json`
  - 公開してよいプラン案内だけ
- `../src/`
  - 公開スクリプトの TypeScript 正本

## 方針

- Cloudflare Pages では無料表示部分だけを配信する
- 有料データは別の secure API と private storage で管理する
- フロントは API 経由で必要な分だけ取得する
- public repo には公開可能なコードとモックだけを置く
