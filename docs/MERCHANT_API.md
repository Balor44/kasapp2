# Merchant API

Lets a merchant accept a KasApp voucher and receive the KAS on chain at an address they choose.

## Endpoint

    POST /api/v1/merchant/redeem
    Content-Type: application/json
    x-admin-key: <ADMIN_API_KEY>
    x-api-key: <your merchant key>

Both headers are required. The admin key protects the API route as a whole. The merchant key identifies you. Keys are set by the operator with `MERCHANT_API_KEYS` (one key per merchant, `name:key` pairs separated by commas) or the single `MERCHANT_API_KEY`.

## Request body

| Field | Required | Meaning |
| --- | --- | --- |
| `code` | yes | The voucher code, for example `KASP-3D8A-AB8B-846F-2774`. Case and spacing are normalised. |
| `merchantAddress` | yes | The Kaspa address that receives the payment. It must belong to the network the server runs on (`kaspa:` on mainnet, `kaspatest:` on testnet). |
| `pin` | only for large vouchers | Second factor required for vouchers of 10,000 KAS or more. |

## Responses

| HTTP | `status` | Meaning | What to do |
| --- | --- | --- | --- |
| 200 | `PAID` | The payment was broadcast. Body has `amount` (KAS) and `txId`. | Mark the order paid. |
| 202 | `PENDING` | The payment is being confirmed. | Retry the same request later. It never pays twice. |
| 202 | `REVIEW` | The payment needs a manual check by the operator. | Do not retry. Contact the operator with the voucher code. |
| 502 | `FAILED` | The payment could not be sent and the voucher is released. `retryable` is true. | Retry the same request. |
| 400 | none | Rejected before anything was claimed: wrong network address, or a missing or wrong `pin`. | Fix the request. |
| 404 | none | Unknown or already redeemed voucher, or a voucher claimed by another merchant. | Do not retry. |
| 401 | none | Missing or wrong key. | Check both headers. |
| 500 | none | Server error. | Retry later. Retries are safe. |

## Idempotency

Redemption is idempotent per voucher. Repeating the same request (same merchant, same address, same code) returns the same operation and never pays twice, so it is always safe to retry after a timeout or a 5xx. A different merchant or a different address cannot take over a voucher that is already being redeemed.

## Example

    curl -X POST https://your-host/api/v1/merchant/redeem \
      -H "Content-Type: application/json" \
      -H "x-admin-key: $ADMIN_API_KEY" \
      -H "x-api-key: $MERCHANT_KEY" \
      -d '{"code":"KASP-3D8A-AB8B-846F-2774","merchantAddress":"kaspa:qq..."}'

Success:

    {"success":true,"status":"PAID","message":"Payment successfully processed","amount":10,"txId":"..."}

## Notes for merchants

* "PAID" means the transaction was broadcast to the Kaspa network. Kaspa confirms in seconds, but for high value orders you can check the `txId` in a block explorer before handing over goods.
* Keep your key secret. If it leaks, ask the operator to remove it from `MERCHANT_API_KEYS`.
