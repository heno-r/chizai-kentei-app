# 決済導線の本番実装メモ

## 目的

現在の `購入手続きに進む` は local stub で状態を再現している。  
本番では買い切り課金に差し替えるため、設定項目と接続順を先に固定する。

## 想定プロバイダ

- 第一候補: Stripe
- 商品:
  - `3級プレミアム版`
  - 買い切り
  - `1,200円`
  - 追加月額料金なし

## 事前に持つ設定値

- `checkoutProvider`
  - `local_stub` または `stripe`
- `stripePublishableKey`
- `stripePriceId`
- `supportEmail`

## 実装順

1. `site` に決済設定の受け皿を置く
2. secure API で `billing/checkout/start` を本物の checkout session 作成に置き換える
3. 購入前ページで `checkout_url` が返ったら Stripe へ遷移する
4. `billing/webhook` で `orders` を `paid` に更新する
5. entitlement を付与する
6. `/api/secure/license/status` で `active_plan = premium` を返す

## 注意

- Stripe の秘密鍵は public repo に置かない
- webhook secret は Cloudflare Workers secrets に置く
- 購入完了直後は `paid_pending_entitlement` を短時間許容する
