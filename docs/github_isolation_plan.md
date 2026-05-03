# GitHub 分離運用方針

- 作成日: 2026-04-30
- 対象: 知財検定学習アプリ
- 目的: 既存の ISS リポジトリ群と完全に分離した GitHub 運用を行う

## 結論

既存の ISS リポジトリ群と本当に分離したいなら、`同じ GitHub アカウント内で repo だけ分ける` では足りません。  
最低でも、次の単位で分けるのが安全です。

1. GitHub アカウント
2. GitHub リポジトリ
3. SSH キー
4. Git 設定
5. Cloudflare / Supabase / 決済アカウント

## 推奨方針

### 1. GitHub アカウントを新規で分ける

おすすめ:

- 知財検定アプリ専用の GitHub アカウントを新規作成する
- 既存 ISS 用アカウントとは完全に別にする

理由:

- repo の見間違いを防げる
- 誤 push をかなり減らせる
- Actions / App / token / billing の混線を防げる

## 2. メールアドレスも分ける

理想:

- GitHub 登録メールも専用にする

最低限:

- Git の `user.email` はこのプロジェクト専用値にする

例:

- `yourname+chizai@...`

## 3. SSH キーを分ける

これはかなり大事です。

このプロジェクト専用で:

- 新しい SSH キーを作る
- 既存 ISS 用キーを使い回さない

理想の構成:

- `id_ed25519_iss`
- `id_ed25519_chizai`

そして `~/.ssh/config` で host を分ける。

例:

```sshconfig
Host github-chizai
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_chizai
  IdentitiesOnly yes

Host github-iss
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_iss
  IdentitiesOnly yes
```

この場合、知財アプリ側の remote はこうする。

```bash
git@github-chizai:your-account/chizai-app.git
```

## 4. Git 設定も repo 単位で分ける

このプロジェクトでは、グローバル設定ではなくローカル設定を明示する。

設定例:

```bash
git config user.name "Your Name"
git config user.email "yourname+chizai@example.com"
```

必要なら署名設定も別にする。

## 5. Cloudflare / Supabase / 決済も分ける

本当に隔離するなら、GitHub だけ分けても不十分です。

少なくとも次は分離したほうが安全です。

- Cloudflare プロジェクト
- Supabase プロジェクト
- 決済サービスの商品設定
- Webhook secret
- 本番用環境変数

## 6. public / private repo の分け方

この案件では次の2本が自然です。

### public repo

入れてよいもの:

- `site/`
- `quiz_app/` の公開して問題ない部分
- 型定義
- API 契約書
- 公開用ドキュメント

入れないもの:

- 有料問題の本体
- secure API の秘密実装
- 決済 webhook
- 本番 secrets

### private repo

入れるもの:

- secure API
- 支払い処理
- entitlement 判定
- 本番用環境変数テンプレート
- 有料問題配信ロジック

## 7. 一番安全なアカウント構成

最も安全なのは次です。

- GitHub 個人アカウントを新規作成
- その配下にこの案件専用 repo を作る
- 必要ならそのあと専用 Organization を作る

現時点では、まずは `専用個人アカウント + 専用 repo` で十分です。

## 8. こちらのおすすめ

おすすめ順:

1. 新しい GitHub アカウントを作る
2. この案件専用の SSH キーを作る
3. public repo と private repo を分ける
4. Cloudflare / Supabase もこの案件専用プロジェクトで作る

## 9. あなたに用意してほしいもの

最低限:

1. 新しい GitHub アカウントを作るかどうかの判断
2. そのアカウント名
3. public repo 名
4. private repo 名

おすすめの repo 名例:

- public: `chizai-kentei-app`
- private: `chizai-kentei-secure`

## 10. 次にこちらができること

これが決まれば次に進められる。

1. GitHub 分離運用の最終案を固定する
2. public / private repo のディレクトリ切り分け案を作る
3. Git remote と公開対象ファイルの整理案を作る
