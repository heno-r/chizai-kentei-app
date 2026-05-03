# 返金時の運用手順

この手順は、購入者への返金が必要になったときに、

- Stripe 側の返金
- D1 側の `orders / entitlements` の整理
- アプリ上のプレミアム権限解除

を順番に行うためのメモです。

## 1. まず確認すること

- 返金対象のメールアドレス
- Stripe の対象 payment
- そのユーザーがすでにプレミアム問題を解いているか

返金条件の案内は [C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\legal\index.html](C:\Users\henoh\OneDrive\Dev\知財検定学習アプリ\site\legal\index.html) に合わせます。

## 2. Stripe で返金する

Stripe Dashboard の live mode で:

1. `Payments`
2. 対象の支払いを開く
3. `Refund payment`
4. `Full refund` を選ぶ

補足:

- 部分返金なら `Partial refund` でもよい
- 返金先は元の支払い手段のみ

参考:

- [Stripe refunds](https://docs.stripe.com/refunds?locale=en-GB)

## 3. D1 で対象ユーザーを確認する

Cloudflare Dashboard:

1. `Workers & Pages`
2. `D1`
3. `chizai-kentei-license`
4. `Console`

まず対象ユーザーを特定します。

```sql
SELECT id, auth_user_id, email, display_name, status, created_at, updated_at
FROM users
WHERE email = 'user@example.com'
ORDER BY updated_at DESC;
```

`users.id` を控えます。

## 4. D1 で購入履歴を確認する

```sql
SELECT id, user_id, product_code, order_status, purchased_at, updated_at
FROM orders
WHERE user_id = 'USERS_ID_HERE'
ORDER BY updated_at DESC;
```

```sql
SELECT id, user_id, plan_code, product_code, status, granted_at, updated_at
FROM entitlements
WHERE user_id = 'USERS_ID_HERE'
ORDER BY updated_at DESC;
```

## 5. D1 でプレミアム権限を外す

先に `entitlements` を消します。

```sql
DELETE FROM entitlements
WHERE user_id = 'USERS_ID_HERE';
```

次に `orders` を消します。

```sql
DELETE FROM orders
WHERE user_id = 'USERS_ID_HERE';
```

補足:

- `users` 自体は消さなくてよい
- やりたいのは「アカウント削除」ではなく「購入状態リセット」

## 6. 消えたか確認する

```sql
SELECT id, user_id, plan_code, product_code, status
FROM entitlements
WHERE user_id = 'USERS_ID_HERE';
```

```sql
SELECT id, user_id, product_code, order_status
FROM orders
WHERE user_id = 'USERS_ID_HERE';
```

両方 0 件ならリセット完了です。

## 7. アプリ側で確認する

1. 対象ユーザーでログアウト
2. 再ログイン
3. `/app/` を開く

確認ポイント:

- 無料版として表示される
- プレミアム機能のロックが戻る
- `無料50問 + 追加0問` 側に戻る

## 8. 問い合わせ対応メモ

問い合わせフォームから返金依頼が来た場合は、

1. 返金対象のメールアドレスを確認
2. Stripe で返金
3. D1 の `orders / entitlements` をリセット
4. 必要なら返信で対応完了を案内

の順で処理します。
