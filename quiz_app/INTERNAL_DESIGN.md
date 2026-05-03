# Quiz App Internal Design

## 目的

現在の `quiz_app/app.js` は試作としては十分だが、今後のスマホ本番化と有料機能連携を考えると責務分割が必要。

この文書では、次の段階でどう分解するかを固定する。

## 設計方針

- まずは Web ベースで設計を固める
- UI と出題ロジックを分離する
- 無料版と有料版の差は feature flag と entitlement で表現する
- 将来 API 化しても、ローカル試作が壊れないよう adapter を挟む

## 現在の状態

`app.js` 1ファイルに以下が混在している。

- 画面遷移
- 問題読み込み
- 履歴保存
- 出題モード判定
- 要復習制御
- プラン制御
- 結果表示

試作では動くが、今後は以下の分割が必要。

## 目標構成

```text
quiz_app/
  index.html
  styles.css
  app.js
  data/
  src/
    core/
      quiz-engine.js
      mode-strategies.js
      scoring.js
    services/
      question-repository.js
      history-repository.js
      paused-session-repository.js
      flagged-question-repository.js
      entitlement-service.js
    state/
      app-state.js
    ui/
      screen-controller.js
      start-screen.js
      quiz-screen.js
      result-screen.js
    config/
      feature-flags.js
      runtime-config.js
```

## レイヤーごとの責務

### `core/`

純粋ロジックを置く。DOM に触れない。

- 問題キュー生成
- モード別出題戦略
- 採点
- 苦手カテゴリ判定
- おすすめ学習判定

### `services/`

外部入出力をまとめる。

- 問題データ取得
- `localStorage` 永続化
- 将来の API 通信
- entitlement 判定取得

### `state/`

画面全体の現在値を持つ。

- 現在モード
- 現在問題
- 回答履歴
- 一時停止状態
- フラグ状態
- プラン状態

### `ui/`

DOM 更新専用。

- 開始画面描画
- 問題画面描画
- 結果画面描画
- ボタンイベント接続

### `config/`

環境差分を吸収する。

- ローカル試作
- 公開無料版
- 将来の有料接続版

## 主要データモデル

### `Question`

```json
{
  "id": "string",
  "level": "3級",
  "category": "著作権",
  "subtopic": "著作権の発生",
  "prompt": "string",
  "options": ["string"],
  "answer_index": 0,
  "explanation": "string",
  "option_explanations": ["string"],
  "memory_tip": "string"
}
```

### `AnswerRecord`

```json
{
  "questionId": "string",
  "category": "string",
  "correct": true,
  "selectedIndex": 0
}
```

### `SessionRecord`

```json
{
  "playedAt": "ISO8601",
  "mode": "sequential",
  "totalQuestions": 5,
  "answeredCount": 4,
  "correctCount": 3,
  "wrongQuestionIds": ["id"],
  "wrongCategories": ["著作権"],
  "answerDetails": []
}
```

### `Entitlement`

```json
{
  "planCode": "free",
  "features": ["sequential_mode", "random_mode"],
  "expiresAt": null
}
```

## feature flag の考え方

プラン名で直接分岐するのではなく、機能キーで分岐する。

例:

- `sequential_mode`
- `random_mode`
- `category_mode`
- `final14_mode`
- `flagged_mode`
- `pause_resume`
- `retry_wrong`
- `weak_focus`
- `study_plan`
- `recommendation`
- `category_stats`
- `recent_sessions`
- `flagged_priority`

これにより、将来プラン変更があっても UI ロジックを壊しにくい。

## 画面構成

### 開始画面

- モード選択
- カテゴリ選択
- 履歴サマリ
- おすすめ学習
- 直前14日プラン
- 中断再開

### 問題画面

- 問題文
- 選択肢
- 要復習トグル
- 正誤表示
- 解説
- 中断
- 中止して評価

### 結果画面

- 正答率
- 苦手カテゴリ
- 復習候補
- 間違えた問題だけ復習
- 要復習だけ復習
- 苦手カテゴリ継続

## 将来の API 接続点

### 無料版

- `question-repository.js`
  - local JSON または public API

### 有料版

- `entitlement-service.js`
  - ログイン後のライセンス取得
- `question-repository.js`
  - secure API 経由で paid pack を取得

UI は repository の取得元を知らないようにする。

## リファクタ優先順

1. `core` と `services` を `app.js` から抜く
2. `localStorage` 系を repository 化する
3. `feature-flags.js` にプラン判定を集約する
4. 画面描画を `ui/` に逃がす
5. 無料API版 adapter を追加する
6. entitlement adapter を追加する

## 次に実装するなら

最初の着手点は次の3つが妥当。

1. `feature-flags.js` を切り出す
2. `question-repository.js` を切り出す
3. `history-repository.js` を切り出す

この3つを先に抜くと、`app.js` の複雑さをかなり落とせる。
