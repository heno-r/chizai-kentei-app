# API Contract

公開サイトと無料版アプリが前提にする API 契約です。  
`site/` に置く静的ページは、この契約に従う `public API` から必要な分だけ取得します。

## Public API

### `GET /api/public/catalog?plan=free`

- 用途: 公開中の問題セット一覧を返す
- 主な利用先: `quiz_app`, 将来のセット選択 UI
- クエリ:
  - `plan`
    - `free` または `premium`
    - 省略時は `free`

成功時の例:

```json
{
  "sets": [
    {
      "set_id": "grade3_mixed_priority_50",
      "label": "3級無料公開50問",
      "short_description": "3級の主要論点を広く確認できる無料公開50問セット。",
      "audience_tag": "無料公開",
      "level": "3級",
      "visibility": "public",
      "required_plan": "free",
      "published_at": "2026-04-29T14:46:28.402Z",
      "question_count": 50
    }
  ]
}
```

失敗時の例:

```json
{
  "error": "internal_error"
}
```

### `GET /api/public/questions?set_id=grade3_mixed_priority_50&plan=free`

- 用途: 指定した公開問題セットを返す
- 主な利用先: `quiz_app`, 将来の本番無料版アプリ
- クエリ:
  - `set_id`
    - 問題セットID
    - 省略時は、そのプランで見える最新の公開セット
  - `plan`
    - `free` または `premium`
    - 省略時は `free`

成功時の例:

```json
{
  "version": "2026-04-29T14:46:28.402Z",
  "set_name": "3級無料公開50問",
  "set_description": "3級の主要論点を広く確認できる無料公開50問セット。",
  "set_tag": "無料公開",
  "required_plan": "free",
  "question_count": 50,
  "questions": [
    {
      "id": "chizai3-010",
      "level": "3級",
      "category": "意匠",
      "subtopic": "意匠が守るもの",
      "prompt": "意匠が守るものについての次の記述のうち、最も適切なものはどれか。",
      "options": [
        "商品の機能そのもの",
        "商品の見た目のデザイン",
        "著作者の人格的利益",
        "会社の信用"
      ],
      "answer_index": 1,
      "explanation": "正解は『商品の見た目のデザイン』である。",
      "option_explanations": [
        "『商品の機能そのもの』は適切でない。",
        "",
        "『著作者の人格的利益』は適切でない。",
        "『会社の信用』は適切でない。"
      ],
      "memory_tip": "意匠は見た目を守る。"
      ,
      "reference_links": [
        {
          "title": "意匠とは",
          "publisher": "特許庁",
          "section": "意匠法の保護対象",
          "url": "https://www.jpo.go.jp/system/design/gaiyo/seidogaiyo/chizai05.html"
        }
      ]
    }
  ]
}
```

`set_id` が見つからない場合の例:

```json
{
  "error": "Public question set not found: grade3_mixed_priority_50"
}
```

HTTP status:

- `200`: 成功
- `404`: 指定セットが見つからない、またはそのプランでは見えない

## フロント側の前提

- `quiz_app` はこの API 契約をそのまま使う
- `site/app` は販促用の静的プラン比較を別JSONで持ってよい
- ただし、無料問題の取得は将来的にこの API 契約へ寄せる
- `publicApiBaseUrl` は `/api/public/...` の親URLを指す
  - 例: `https://example.com`

## Secure API

### `GET /api/secure/license/status`

- 用途: ログインユーザーの購入状態確認
- 認証: `Authorization: Bearer <token>`
- トークン前提:
  - 本番では Supabase の access token を想定
  - `sub` を `auth_user_id` として扱う
  - `email` や `name` が取れる場合は、初回アクセス時の `users` 同期に使ってよい
- 主な利用先: `site/login`, `site/app`, `site/premium/ready`

成功時の例:

```json
{
  "signed_in": true,
  "purchase_state": "entitled",
  "active_plan": "premium",
  "user": {
    "user_id": "local-premium-user",
    "display_name": "プレミアム版ユーザー"
  },
  "entitlements": [
    {
      "plan_code": "premium",
      "product_code": "grade3_premium",
      "scope_type": "plan",
      "scope_id": "grade3_premium",
      "status": "active",
      "granted_at": "2026-04-30T10:00:00+00:00",
      "expires_at": null
    }
  ],
  "source": "local_db"
}
```

未ログイン時の例:

```json
{
  "signed_in": false,
  "purchase_state": "not_started",
  "active_plan": "free",
  "user": null,
  "entitlements": [],
  "source": "guest_local"
}
```

### `POST /api/secure/billing/checkout/start`

- 用途: 購入手続き開始状態の記録
- 認証: 必須
- トークン前提: `license/status` と同じ
- 主な利用先: `/premium/ready/`

成功時の例:

```json
{
  "checkout_id": "9f0c4d0e1f9b4c06a3e47f57c3f3d001",
  "purchase_state": "in_checkout",
  "product_code": "grade3_premium",
  "price_jpy": 1200,
  "checkout_url": "/premium/ready/"
}
```

### `POST /api/secure/billing/checkout/complete`

- 用途: 購入完了後の権利付与
- 認証: 必須
- トークン前提: `license/status` と同じ
- 主な利用先: `/premium/ready/`

成功時の例:

```json
{
  "signed_in": true,
  "purchase_state": "entitled",
  "active_plan": "premium",
  "user": {
    "user_id": "local-free-user",
    "display_name": "無料版ユーザー"
  },
  "entitlements": [
    {
      "plan_code": "premium",
      "product_code": "grade3_premium",
      "scope_type": "plan",
      "scope_id": "grade3_premium",
      "status": "active",
      "granted_at": "2026-04-30T10:05:00+00:00",
      "expires_at": null
    }
  ],
  "source": "local_db",
  "checkout_id": "9f0c4d0e1f9b4c06a3e47f57c3f3d001"
}
```

### `GET /api/secure/premium/manifest?plan_code=grade3_premium`

- 用途: プレミアム版の解放対象 manifest を返す
- 認証: 必須
- トークン前提: `license/status` と同じ
- 備考: ライセンス未保有なら `403`

成功時の例:

```json
{
  "plan_code": "grade3_premium",
  "active_plan": "premium",
  "label": "3級プレミアム版",
  "recommended_entry_path": "/app/",
  "base_public_set_id": "grade3_mixed_priority_50",
  "merge_strategy": "append_non_duplicate",
  "question_sets": [],
  "unlocked_features": [
    "category_mode",
    "retry_wrong",
    "weak_category_analysis",
    "flagged_queue",
    "today_recommendation",
    "final14_mode",
    "study_plan",
    "detailed_history"
  ]
}
```

補足:

- `question_sets` が空のときは、プレミアム機能だけ解放し、問題本体は無料公開セットへフォールバックしてよい
- `base_public_set_id` を土台にし、`merge_strategy = append_non_duplicate` ならプレミアム問題を追加で混ぜて使ってよい
- `question_sets` があるときは、registry の順で読み込み、同じ `question_id` は重複追加しない

### `GET /api/secure/premium/questions?set_id=...`

- 用途: プレミアム版の問題セット本体を返す
- 認証: 必須
- 備考:
  - `active_plan = premium` が必要
  - プレミアム問題セット未登録なら `404`

成功時の例:

```json
{
  "version": "2026-04-30T05:00:00+00:00",
  "set_id": "grade3_premium_main",
  "set_name": "3級プレミアム版 本編",
  "set_description": "3級プレミアム版の本編問題セット。",
  "set_tag": "プレミアム本編",
  "required_plan": "premium",
  "question_count": 120,
  "questions": []
}
```

## 決済まわり

### `POST /api/secure/billing/webhook`

- 用途: 決済完了反映
- 実装: private repo 側のみ
- 注意: secret を public repo に置かない
