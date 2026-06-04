# 公開直後 1 週間の運用メモ

正式公開直後の 1 週間は、まず次の 3 つを優先して見ます。

- 問い合わせが来ていないか
- 購入や返金で詰まりが出ていないか
- 問題追加や差し替えが必要になっていないか

このメモは、毎日どこを見ればよいかを短く整理したものです。

## 1. 毎日見るもの

まずは次を実行すると、問い合わせ件数、公開サイト疎通、secure API の生存確認をまとめて見られます。

```powershell
C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\run_daily_operations_check.bat
```

出力は次にも保存されます。

- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\daily_operations_report.local.txt](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\daily_operations_report.local.txt)

### 朝か昼に 1 回

- `review_tool` の `本番問い合わせ`
  - 新しい問い合わせがないか
  - `new` のまま残っているものがないか
  - CLI なら `production_contact_admin_cli.bat list --status new`
- Stripe Dashboard
  - 支払い失敗や返金対応が必要なものがないか

### 夜に 1 回

- `review_tool` の `本番問い合わせ`
  - 返信待ちのものを `in_progress` にできているか
  - 対応完了したものを `done` にできているか
- 公開サイト
  - `/`
  - `/app/`
  - `/premium/ready/`
  - `/contact/`
  が普通に開くか

## 2. 問い合わせ対応

問い合わせの確認と状態更新は、次の手順を使います。

- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md)
- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_roundtrip_check.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_roundtrip_check.md)

基本ルール:

- 未確認: `new`
- 内容確認中、返信待ち: `in_progress`
- 対応完了: `done`

迷ったら、まず `in_progress` にしてから返信内容を整理します。

## 3. 返金対応

返金依頼が来たら、次の手順に従います。

- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\refund_operation_steps.md)

流れ:

1. Stripe で返金
2. D1 の `orders / entitlements` を削除
3. 再ログインで無料版へ戻ることを確認
4. 必要なら問い合わせへ返信

## 4. 問題追加や差し替え

プレミアム問題を増やす、差し替えるときは次の手順を使います。

- [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\production_premium_release_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\production_premium_release_steps.md)

基本の流れ:

1. `review_tool` で承認
2. `content_admin` で DB publish
3. R2 へ JSON をアップロード
4. Worker を再デプロイ
5. `/app/` で `無料50問 + 追加N問` を確認

## 5. 最初の 1 週間で意識すること

- 問い合わせ返信が遅れないこと
- 購入後にプレミアム解放されないケースを見逃さないこと
- 法務ページや価格表示に誤解を生む文言がないこと

## 6. 1 週間後に見直すこと

- 問い合わせ件数はどれくらいか
- 返金依頼が発生したか
- よくある質問を LP や購入前ページに足したほうがよいか
- 問題追加の優先度が上がっているか
