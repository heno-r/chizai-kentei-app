# Review Tool

人手チェック専用の GUI アプリ。

## 役割

- データセットを切り替えてレビュー対象 JSON を読む
- 問題ごとのレビュー結果を入力する
- JSON と CSV を更新する

## 判定表示

- `承認`
- `保留`
- 一覧の未処理項目は `未確認` として表示

## 起動

```powershell
uv run python review_gui.py
```

## 保存先

- `../shared_content/first_release_question_packets_enriched.json`
- `../shared_content/first_release_review_tracker.csv`
- `../shared_content/human_review_fill_template.csv`

## 使い方メモ

- `shared_content` に `*_question_packets_enriched.json` を置くと、起動時にデータ候補として自動認識される
- 画面上部の `データ` で `grade3_mixed_priority_50` / `first_release_5` / `draft_100` / `draft_additional_200` / `grade2_draft_200` / `grade3_priority_80` / `grade3_incorrect_200` などを切り替えられる
- `未レビューへ` で、まだ人手レビューしていない問題をすぐ開ける
- `承認分をDBへ反映` で、現在選択中データセットの `approved` 問題だけを `../content_admin/data/content.db` に publish できる
- publish 前に `set_id` / `公開名` / `公開` / `必要プラン` を上段で上書きできる
- publish 前に `用途タグ` と `紹介文` も指定できる
- publish 時に `プレミアム版に含める` をオンにすると、`../content_admin/premium_plan_registry.json` にも追加される
- 現状の配信方式は `append_non_duplicate` を選べる
- `DBビューア` では、配信用DBに入っているセット一覧だけでなく、登録済みの問題文・選択肢・解説・記憶メモまで確認できる
- `DBビューア` の上部サマリで、`無料公開 / プレミアム公開 / 非公開` の件数も確認できる
- `DBビューア` から、選択中セットの `公開名` / `紹介文` / `用途タグ` / `公開` / `必要プラン` / `有効` を直接更新できる
- `DBビューア` から、選択中セットを `プレミアム版に含める` / `配信方式` まで更新できる
- `DBビューア` から、不要なDBセットを削除できる
- `draft_100` では、必要なら `draft_100_human_review_fill_template.csv` を自動生成して保存する
- `承認して次へ` / `保留して次へ` で、保存と次問題への移動をまとめて処理できる
- ショートカットは `Ctrl+Enter` で承認して次へ、`Ctrl+H` で保留して次へ
- `並び` を `subtopic` にすると、同じサブトピックをまとめて見られる
- `同サブトピックへ` で、今見ている論点の未レビュー問題へすぐ飛べる
- 問題詳細とレビュー入力欄では `Ctrl + マウスホイール` で文字サイズを拡大・縮小できる
- レビュー入力欄では `Ctrl+Z` / `Ctrl+Y` で元に戻す / やり直しができる
