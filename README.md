# Kasapp

Kasapp is a Kaspa (KAS) wallet and bill payment service that runs inside WhatsApp. Users chat with a bot to create a wallet, send KAS to phone numbers, addresses or KNS names, buy and redeem vouchers, and pay for airtime, data, electricity, cable TV and water with KAS.

It is built to make Kaspa easy to use for people who have never used a crypto wallet, starting with Nigeria.


## How it works, and who holds the keys

Please read this section before using Kasapp with real funds. It describes what the code does today.

*   **The service holds the keys.** Each user gets a wallet generated on the server. The seed phrase is stored in MongoDB encrypted with AES 256 GCM, using `ENCRYPTION_KEY`. Whoever runs the service, and whoever has the database plus that key, can sign for users. This is a custodial design. Users can export their recovery phrase with `/export` after setting a PIN.
*   **Vouchers are operator held.** Creating a voucher sends KAS from the user's wallet to the operator wallet and records a bearer code. Redeeming pays out from the operator wallet. The `contracts/` folder holds an experimental covenant artifact, but vouchers are not enforced by an on chain contract today.
*   **High value lock.** Redeeming a voucher of 10,000 KAS or more through the merchant API requires the `ARGENT_MASTER_PIN`. This check applies to the merchant API only, not to redemption through WhatsApp.
*   **Bill payments.** KAS is sent on chain to the operator wallet, the bill is bought from the provider (VTpass or Flutterwave), and if the provider fails the KAS is refunded on chain. The operator keeps a prefunded Naira balance with the provider.
*   **Merchant API.** `POST /api/v1/merchant/redeem` lets a merchant redeem a voucher code to a Kaspa address. It requires the admin key and the merchant key.


## Requirements

*   Node.js 22 or newer (the Docker image uses Node 24)
*   MongoDB
*   Redis
*   A Meta WhatsApp Cloud API app, plus provider accounts for the features you turn on


## Setup

```bash
git clone https://github.com/Balor44/kasapp2.git
cd kasapp2
npm install
cp .env.example .env
```

Edit `.env` and replace every value. Generate secrets with `openssl rand -hex 32`. The server checks your configuration at startup and refuses to start if a secret is missing, still a placeholder, or the PIN is weak, if the Kaspa network name is invalid, or if the connected node is on a different network than `KASPA_NETWORK`.

Back up `ENCRYPTION_KEY`. If it is lost or changed, stored wallets cannot be decrypted.


## Running

```bash
npm run dev          # development with auto reload
npm run build        # compile TypeScript to dist/
npm start            # run the compiled server
npm test             # build, then run the unit tests
```

Docker: `docker build -t kasapp .` then run it with your environment variables. The container runs as a non root user.

Health endpoints:

*   `GET /health` returns 200 while the process is up.
*   `GET /ready` returns 200 only when MongoDB and Redis are reachable, otherwise 503.


More documentation:

*   `docs/DEPLOYMENT.md`: configuration, Render and Docker deployment, testnet checklist, mainnet go live and rollback.
*   `docs/MERCHANT_API.md`: the merchant voucher redemption endpoint.


## Testing safely before mainnet

1.  Set `KASPA_NETWORK=testnet-10` and use a testnet operator address (it starts with `kaspatest:`).
2.  Use sandbox keys for Paystack, Flutterwave and VTpass (`VTPASS_BASE_URL=https://sandbox.vtpass.com/api`). On a testnet the server refuses to start if any of these is a live setting, so a test cannot spend real Naira.
3.  Send test messages without WhatsApp by calling `POST /api/message` with the `x-admin-key` header and a body like `{"phone": "+234...", "message": "balance"}`.
4.  Check that KAS leaves the user wallet, the operator wallet receives it, and a deliberate provider failure triggers a refund.


## Security notes

*   Startup configuration checks never print secret values.
*   The WhatsApp and Paystack webhooks verify signatures against the exact raw request body.
*   Voucher claims are atomic, so a code cannot be redeemed twice at the same time.
*   Set `CORS_ORIGINS` so only your own website can call the public API from a browser.
*   Never commit `.env`. Treat the operator seed phrase as the most sensitive value you have.

How money is kept safe from crashes:

*   Every payment, bill purchase, voucher payout and refund is an **operation** stored in MongoDB (`Operation` model). The transaction id is saved before it is broadcast, so after a crash the app looks the transaction up on chain instead of guessing.
*   A reconciler runs on start and every 30 seconds and finishes anything left open. It refunds only when failure is proven: the provider said failed, or the transaction was never seen and its inputs are still unspent after `OP_SETTLE_MS`. A timeout, an unreachable node or an unclear answer is never treated as a failure.
*   Anything it cannot decide goes to `NEEDS_REVIEW` and alerts the admin on WhatsApp. Nothing is paid or refunded automatically from that state.
*   Balances are exact integers (`balanceSompi`). Each credit and debit carries a reference that is stored in the same atomic update, so a retry can never apply twice.
*   VTpass request ids carry the Lagos date as VTpass requires, and bill purchases use one stable reference per operation, so a retry cannot buy twice.

Upgrading an existing database (take a backup first, both commands are dry runs until you add `--apply`):

    npm run migrate:balances
    npm run migrate:seeds

Known limits, so nobody is surprised:

*   The balance shown in the database is a cache of the user's on chain wallet. Credits that exist only in the database (a voucher redeemed through the REST API) are replaced by the chain balance the next time the user runs a balance sync. Use WhatsApp redemption, which pays on chain.
*   One operator hot wallet pays everything. Set `OPERATOR_MIN_RESERVE_KAS`, keep only a few days of float in it, and move the rest with `/admin sweep` to a cold wallet whose seed is never on the server (`COLD_WALLET_ADDRESS`).
*   Seeds are encrypted with one `ENCRYPTION_KEY`. Anyone with the database and that key can spend user funds. This is a custodial design.
*   Set `MAX_SEND_KAS_PER_DAY` and `MAX_SEND_KAS_PER_TX`.
*   Test on testnet with crash injection (kill the server right after a send, and while a provider call is in flight) before using real money.
*   Report vulnerabilities privately by opening a security advisory on GitHub rather than a public issue.


## License

MIT. See `LICENSE`.
