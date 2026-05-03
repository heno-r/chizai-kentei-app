# Content DB Migration

## 結論

- `shared_content` のレビュー済み JSON を編集用の原本として残す
- アプリ配信用には DB を別に持つ
- `review_tool` は直接本番 DB を触らず、`承認 -> publish` の 2 段階にする
- `quiz_app` は `questions.json` 直読みをやめて API 経由に寄せる

この構成にすると、レビュー作業と公開配信を分離できる。

## 役割分担

### 編集用の原本

- 場所: `shared_content/*.json`
- 用途:
  - claim
  - sources
  - human_review
  - assistant_review
  - 公開前メモ

ここは人が読む前提の情報が多く、入れ子も深いので JSON のまま持つほうが扱いやすい。

### 配信用の DB

- 用途:
  - アプリが読む問題本文
  - 出題対象のセット
  - 無料/有料の公開状態
  - 必要最小限の公開メタデータ

ここはアプリが速く安全に読むためのストアと割り切る。

## 推奨フロー

1. `review_tool` で問題を `approved` にする
2. `publish` スクリプトが `shared_content` を検証する
3. `approved` の問題だけを配信用スキーマへ変換する
4. 配信用 DB に `upsert` する
5. `quiz_app` と公開サイトは API 経由で DB を読む

## 重要な設計判断

### 1. レビューツールは直接本番 DB に書かない

理由:

- 誤操作で未承認問題が出る事故を防ぎやすい
- 承認と公開を分けて監査しやすい
- 本番 DB の認証情報をデスクトップ GUI に埋め込まずに済む

`review_tool` は引き続き `shared_content` だけを更新し、公開作業は別の `publish` 処理で行う。

### 2. アプリは最初から API 経由にそろえる

ローカルでも本番でも、`quiz_app` は同じ取得方法にする。

- 現在: `questions.json` を `fetch`
- 今後: `/api/questions` を `fetch`

これで将来 `D1` や別 DB に変わっても、フロントの差し替え範囲が小さい。

### 3. DB は「公開済み問題」中心に最小構成から始める

最初は編集情報をすべて正規化しなくてよい。

- 問題本文
- 選択肢
- 解説
- 覚え方
- 無料/有料フラグ
- 必要プラン
- 公開状態
- 公開セット情報

まずはこれを優先する。

## 最小 DB スキーマ案

### `question_sets`

- `set_id` TEXT PRIMARY KEY
- `label` TEXT NOT NULL
- `level` TEXT NOT NULL
- `visibility` TEXT NOT NULL
- `required_plan` TEXT NOT NULL
- `published_at` TEXT
- `is_active` INTEGER NOT NULL DEFAULT 1

例:

- `grade3_free_starter`
- `grade3_paid_core_001`

### `published_questions`

- `question_id` TEXT PRIMARY KEY
- `set_id` TEXT NOT NULL
- `level` TEXT NOT NULL
- `category` TEXT NOT NULL
- `subtopic` TEXT NOT NULL
- `prompt` TEXT NOT NULL
- `options_json` TEXT NOT NULL
- `answer_index` INTEGER NOT NULL
- `explanation` TEXT NOT NULL
- `option_explanations_json` TEXT NOT NULL
- `memory_tip` TEXT NOT NULL
- `is_free` INTEGER NOT NULL DEFAULT 0
- `required_plan` TEXT NOT NULL
- `status` TEXT NOT NULL
- `source_snapshot_json` TEXT
- `editorial_source_id` TEXT NOT NULL
- `content_hash` TEXT NOT NULL
- `approved_by` TEXT
- `approved_on` TEXT
- `published_at` TEXT
- `updated_at` TEXT NOT NULL

### `publish_batches`

- `publish_id` TEXT PRIMARY KEY
- `dataset_key` TEXT NOT NULL
- `published_by` TEXT NOT NULL
- `question_count` INTEGER NOT NULL
- `published_at` TEXT NOT NULL
- `notes` TEXT

## なぜ `published_questions` に JSON カラムを残すか

最初から選択肢や wrong reason を別テーブルへ完全分割すると、実装コストが上がる。

今回の用途では、まず `TEXT(JSON)` で持つほうがよい。

- `options_json`
- `option_explanations_json`
- `source_snapshot_json`

これなら現在の `questions.json` に近い形で移行できる。

## 公開状態の考え方

`human_review.decision = approved` だけでは配信しない。

最低でも配信用には次の状態を持つ:

- `draft`
- `approved`
- `published`
- `archived`

おすすめはこう:

- `shared_content` では `approved`
- DB へ登録した時点では `published`

つまり「承認済み」と「実際に配信中」を分ける。

## API の責務

### 公開 API

- 無料問題だけ返す
- LP / 無料版 / 記事導線が使う

候補:

- `GET /api/public/catalog`
- `GET /api/public/question-sets/free`
- `GET /api/public/questions?set_id=grade3_free_starter`

### 認証付き API

- ライセンス確認後に配信
- 必要プランに応じて問題セットを返す

候補:

- `GET /api/me/question-sets`
- `GET /api/me/questions?set_id=grade3_paid_core_001`

### 管理 API

- ローカルから publish するための内部 API
- 一般ユーザーからは触れない

候補:

- `POST /internal/publish`
- `POST /internal/publish/preview`

## `review_tool` の今後の役割

今の `review_tool` は次の流れに変えるのが自然:

1. いままで通り JSON と CSV を保存
2. `承認分を反映` の代わりに `承認分を publish` ボタンを追加
3. そのボタンは内部的に publish スクリプトか管理 API を呼ぶ
4. publish 成功時に `publish_id` と件数を表示する

つまり GUI は「承認」と「公開実行」の入口だけを持つ。

## `quiz_app` の今後の役割

`QuizQuestionRepository` を 2 層に分ける。

### 1. 取得インターフェース

- `loadQuestions()`
- `loadQuestionSetCatalog()`

### 2. 実装

- `LocalJsonQuestionRepository`
- `ApiQuestionRepository`

移行順:

1. まず `question-repository.ts` を API ベースへ差し替え可能にする
2. ローカルではモック API を返す
3. 本番では Cloudflare 側 API を返す

## 低コストで始める現実的な順番

### Phase 1

- `shared_content` を原本のまま維持
- publish 用スクリプトを追加
- 出力先はローカル SQLite
- `quiz_app` はローカル API 経由で SQLite を読む

### Phase 2

- publish 先を `D1` に変更
- `quiz_app` は Cloudflare API を読む
- 無料問題セットだけ公開導線につなぐ

### Phase 3

- 認証付き API を追加
- ライセンス別のセット返却
- 購入済みユーザーだけ有料問題配信

## いまのリポジトリに当てはめると

### 残すもの

- `review_tool/`
- `shared_content/`

### 追加するもの

- `content_admin/`
  - publish スクリプト
  - schema
  - migration
- `content_api/`
  - `GET /api/public/questions`
  - `GET /api/public/catalog`
  - `POST /internal/publish`

### 置き換えるもの

- `quiz_app/data/questions.json`
  - 将来的には廃止
- `quiz_app/src/services/question-repository.ts`
  - API ベースへ変更

## 推奨する次の実装順

1. `published_questions` を前提にした SQLite スキーマを作る
2. `approved` 問題だけを SQLite に流し込む publish スクリプトを作る
3. `quiz_app` の `question-repository.ts` を API 前提の形に変える
4. ローカル API を追加して SQLite を返す
5. その API 契約を Cloudflare 側へ持っていく

## 一言でいうと

いちばん安全で後戻りしにくい形は、

- `JSON = 編集用の原本`
- `DB = 配信用の公開済みデータ`
- `review_tool = 承認`
- `publish 処理 = DB 反映`
- `quiz_app = API 参照`

に分けること。
