# Public Repo Policy

## 公開してよいもの

- LP、記事、無料診断
- 無料体験版 UI
- 公開可能な無料問題
- 公開 API の呼び出しコード
- 価格やプランの案内文
- API 契約書、構成メモ

## 公開してはいけないもの

- 有料問題本文
- レビュー前の問題束
- ライセンス判定ロジックの実装詳細
- 決済秘密情報
- Webhook secret
- 秘密鍵、署名鍵
- 購入済みユーザーデータ
- private storage の実 URL

## 運用ルール

1. `site/` は public repo 前提で扱う
2. `shared_content/` は public repo に含めない
3. secure API 実装は private repo に分ける
4. 問題データは `public` と `paid` を別 export にする
5. `.env` `.dev.vars` 系はコミットしない
