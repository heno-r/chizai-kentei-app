# お問い合わせフォーム公開手順

`/contact/` は、Cloudflare Worker の `POST /api/public/contact` に送信し、
内容を `D1` の `contact_messages` に保存する構成です。

## 1. D1 に最新 schema を反映する

`contact_messages` テーブルを追加したので、まず schema を再適用します。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --file=..\content_admin\schema.sql
```

`--file` で import 経路のエラーが出る場合は、必要なテーブルだけ `--command` でも追加できます。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --command="CREATE TABLE IF NOT EXISTS contact_messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, reply_email TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', source_page TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created ON contact_messages(status, created_at DESC);"
```

`query` 系で `The given account is not valid or is not authorized to access this service [code: 7403]` が出る場合は、Cloudflare Dashboard の D1 Console から実行して構いません。

手順:

1. Cloudflare Dashboard
2. `Workers & Pages`
3. `D1`
4. `chizai-kentei-license`
5. `Console`
6. 上の `CREATE TABLE ...` と `CREATE INDEX ...` を貼り付けて実行

## 2. Worker を再デプロイする

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler deploy
```

## 3. `site` を起動してフォーム送信を試す

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site
run_site.bat
```

確認 URL:

- `http://127.0.0.1:8780/contact/`

## 4. 送信内容を D1 で確認する

最近のお問い合わせは次で見られます。

```powershell
cd C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker
npx wrangler d1 execute chizai-kentei-license --remote --command="SELECT id, name, reply_email, status, source_page, created_at, updated_at FROM contact_messages ORDER BY created_at DESC LIMIT 20;"
```

これも `7403` が出る場合は、同じく D1 Console に次を貼って確認できます。

```sql
SELECT id, name, reply_email, status, source_page, created_at, updated_at
FROM contact_messages
ORDER BY created_at DESC
LIMIT 20;
```

同じ内容を SQL ファイルで持っているので、参照用としてはこれです。

- [secure_api_worker/sql/recent_contact_messages.sql](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\secure_api_worker\sql\recent_contact_messages.sql)

## 5. 公開前に見ておくポイント

- 必須項目未入力でエラーになるか
- 正常送信後に完了メッセージが出るか
- `contact_messages` に保存されているか
- `reply_email` が意図どおり保存されているか
- 営業時間や返信目安など、必要な案内を追加するか
