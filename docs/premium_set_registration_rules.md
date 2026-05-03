# プレミアム問題セット登録ルール

## 目的

無料公開セットを土台にしつつ、プレミアム版で追加配信する問題セットを迷わず登録できるようにする。

## 現在の基本方針

- ベース公開セット
  - `grade3_mixed_priority_50`
- プレミアム側の合成方法
  - `append_non_duplicate`
  - 無料50問を残したまま、重複しない問題だけ追加する
- プレミアム商品コード
  - `grade3_premium`

## registry ファイル

- 設定ファイル:
  - [content_admin/premium_plan_registry.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\content_admin\premium_plan_registry.json)

例:

```json
{
  "plans": {
    "grade3_premium": {
      "label": "3級プレミアム版",
      "base_public_set_id": "grade3_mixed_priority_50",
      "merge_strategy": "append_non_duplicate",
      "question_sets": [
        {
          "set_id": "grade3_premium_main",
          "delivery_mode": "append_non_duplicate"
        }
      ]
    }
  }
}
```

## 追加するときの手順

1. 対象 dataset を `review_tool` で承認する
2. `content_admin/publish_approved_questions.py` で `required_plan=premium` として publish する
3. `premium_plan_registry.json` の `question_sets` に `set_id` を追加する
4. `/api/secure/premium/manifest` で `question_sets` に出ることを確認する
5. `/api/secure/premium/questions?set_id=...` で取得できることを確認する
6. `/app/` で `無料50問 + 追加分` になっていることを確認する

## 運用ルール

- プレミアムセットは必ず `required_plan = premium`
- 無料セットをプレミアム専用セットへ置き換えない
- フロントは `base_public_set_id` を土台にし、`question_sets` を追加読み込みする
- 同じ `question_id` は重複追加しない
