# Content Admin

承認済み問題を SQLite に publish し、ローカル API として返すための管理用フォルダ。

## 役割

- `shared_content` の承認済み問題を抽出
- 配信用スキーマに変換
- `content.db` に upsert
- ローカルでは `quiz_app` 用 API を返す
- 問題セットごとの紹介文と用途タグも返す

## 主要ファイル

- `schema.sql`
- `publisher.py`
- `publish_approved_questions.py`
- `local_api_server.py`
- `debug_content_db.py`

## よく使うコマンド

```powershell
uv sync
```

```powershell
uv run python publish_approved_questions.py --dataset-key grade3_mixed_priority_50
```

```powershell
powershell -ExecutionPolicy Bypass -File .\publish_grade3_premium_combined_160.ps1
```

```powershell
powershell -ExecutionPolicy Bypass -File .\export_grade3_premium_combined_160_for_r2.ps1
```

```powershell
uv run python local_api_server.py --port 8765 --static-root ..\quiz_app
```

```powershell
uv run python debug_content_db.py
```

- サマリでは `public_free_sets / public_premium_sets / private_sets / inactive_sets` も確認できる
- `grade3_premium_combined_160` をそのまま DB に反映したいときは `publish_grade3_premium_combined_160.bat` でも実行できる
- 本番 Worker に上げる前に、`export_grade3_premium_combined_160_for_r2.ps1` で R2 用 JSON を書き出せる

```powershell
uv run python debug_content_db.py --set-id grade3_mixed_priority_50
```
