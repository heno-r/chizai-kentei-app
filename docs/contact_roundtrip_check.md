# お問い合わせの往復確認

`/contact/` の送信と、管理側の問い合わせ一覧で見えることを 1 回で確認したいときの手順です。

## 1. 事前準備

- Worker 側に `ADMIN_API_TOKEN` が設定されている
- ローカルに [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\contact_viewer_config.local.json](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool\contact_viewer_config.local.json) を置いている
- `admin_token` は Worker 側と同じ値

## 2. 実行

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool
verify_production_contact_roundtrip.bat
```

`uv` が使える環境なら `uv run python`、なければ bundled Python で実行します。

## 3. 何を確認するか

このスクリプトは次をまとめて行います。

1. `POST /api/public/contact` に確認用のお問い合わせを送る
2. `GET /api/secure/admin/contact-messages` を一定時間ポーリングする
3. 送った `marker` を含む問い合わせが一覧に現れたら成功とする

出力例:

- `submit_result=...`
- `found_message=...`
- `roundtrip check passed`

## 4. 対応状態まで更新したいとき

見つかった問い合わせをそのまま `done` に更新したい場合は、次のようにします。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool
verify_production_contact_roundtrip.bat --mark-status done
```

使える状態:

- `new`
- `in_progress`
- `done`

## 5. 主なオプション

- `--poll-seconds 30`
  - 何秒待つか
- `--poll-interval 2`
  - 何秒ごとに確認するか
- `--limit 20`
  - 最新何件を見に行くか
- `--source-page /contact/?roundtrip_test=1`
  - 保存時の `source_page`

## 6. うまくいかないとき

- `contact submit failed`
  - 公開側の問い合わせ API に届いていない
- `contact fetch failed: HTTP 403`
  - `ADMIN_API_TOKEN` が一致していない
- `marker was not found`
  - 保存遅延、対象件数不足、または保存失敗の可能性がある

必要なら、そのあとに [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\docs\contact_operation_steps.md) の手順で `review_tool` を開き、一覧から詳細を確認します。

CLI でそのまま詳細を見るなら:

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\review_tool
production_contact_admin_cli.bat list --limit 20
production_contact_admin_cli.bat list --status new
production_contact_admin_cli.bat show <問い合わせID>
production_contact_admin_cli.bat reply-draft <問い合わせID>
```
