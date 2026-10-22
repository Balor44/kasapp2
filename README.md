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

Known gaps, so nobody is surprised:

*   There is no automatic reconciliation worker. If the server crashes between taking funds and finishing a payout or provider call, the record needs a manual check.
*   User balances are stored as floating point numbers in MongoDB. On chain amounts use exact integer sompi.
*   All payouts and refunds come from one operator hot wallet.
*   Report vulnerabilities privately by opening a security advisory on GitHub rather than a public issue.


## License

MIT. See `LICENSE`.
