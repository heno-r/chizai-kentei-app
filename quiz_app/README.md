# Quiz App

知財検定アプリ本体のローカル試作版。

## 方針

- 最終版のスマートフォン対応を見据えて、まずはレスポンシブな Web アプリとして作る
- いまはローカルで動けばよいので、軽量な静的構成にする
- 出題ロジック、即時フィードバック、復習導線を先に固める

## できること

- 承認済みの無料公開50問でクイズを開始
- 順番学習とランダム学習の切り替え
- カテゴリ別学習
- 直前14日モード
- 要復習だけ学習
- 1問ごとの正誤判定と解説表示
- 最後にスコアと苦手問題の復習表示
- `localStorage` に学習履歴を保存
- 問題ごとに `要復習 / 最重点` を付けてあとでまとめて解き直せる
- `無料 / スタンダード / プレミアム` のプランフラグで機能開放を切り替えられる
- 途中で `中断してあとで再開` と `ここで中止して評価` ができる
- 公開カタログから問題セットを切り替えられる

## 現在のデータ状態

- 問題原本は `../shared_content/*_question_packets_enriched.json`
- 承認済み問題は `../content_admin/data/content.db` に publish して使う
- `quiz_app` は `questions.json` 直読みではなく、ローカル API 経由で問題を取得する
- `public/free` は無料版・プレミアム版の両方で見え、`public/premium` はプレミアム版でのみ見える

## 起動

```powershell
run_quiz_app.bat
```

`run_quiz_app.bat` は、公開カタログ API が立ち上がってからブラウザを開く。

`index.html` を `file://` で直開きすると問題取得はできない。必ずローカルサーバー経由で開く。

## 主なファイル

- `index.html`
- `styles.css`
- `app.js`
- `run_quiz_app.bat`
- `src/config/feature-flags.js`
- `src/core/history-analytics.ts`
- `src/core/scoring.ts`
- `src/core/study-flow-actions.ts`
- `src/core/study-session-actions.ts`
- `src/core/quiz-engine.ts`
- `src/ui/start-screen.ts`
- `src/ui/quiz-screen.ts`
- `src/ui/result-screen.ts`
- `src/ui/screen-controller.ts`
- `src/services/question-repository.js`
- `src/services/storage-repositories.js`
- `src/services/plan-status.ts`
- `../content_admin/publish_approved_questions.py`
- `../content_admin/local_api_server.py`

## TypeScript 方針

- `src/*.ts` を正本として育てる
- ブラウザは `dist/*.js` を読む
- `typescript` は `quiz_app/node_modules` にローカル導入する
- `src/**/*.ts` から `dist/` を生成する
- プラン状態は `src/services/plan-status.ts` を経由して読み、将来のライセンスAPIへ差し替えやすくする

## いま使えるコマンド

```powershell
.\node_modules\.bin\tsc.cmd -p tsconfig.json
```

型チェックはこのコマンドで実行できる。

```powershell
.\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
```

`package.json` の `build` と `typecheck` でも同じことができる。

## 起動メモ

- `run_quiz_app.bat`
  - 起動前に `tsc` を実行する
  - `grade3_mixed_priority_50` を既定の無料公開セットとして SQLite に publish する
  - `quiz_app` 静的配信と `/api/public/questions` を同時に立てる
- `build_quiz_app.bat`
  - TypeScript のビルドだけ先に回したいときに使う

## 設計メモ

- 内部設計: `INTERNAL_DESIGN.md`
- 全体構成: `../docs/system_architecture.md`
