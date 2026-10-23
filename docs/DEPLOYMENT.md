# Deployment guide

This guide takes KasApp from a fresh clone to a running service, first on testnet and then on mainnet.

## 1. Requirements

* Node.js 22 or newer (the Docker image uses Node 24)
* MongoDB (Atlas free tier is enough for testing)
* Redis (any Redis compatible service)
* A Meta WhatsApp Cloud API app
* Provider accounts for the features you use: VTpass, Flutterwave, Paystack, Groq

## 2. Configuration

    cp .env.example .env

Replace every value. Generate secrets with `openssl rand -hex 32`. The server refuses to start if a secret is missing or still a placeholder, if the PIN is weak, if the network name is invalid, or if the connected Kaspa node is on a different network than `KASPA_NETWORK`.

Back up `ENCRYPTION_KEY`. If it is lost or changed, stored wallets cannot be decrypted.

Settings worth setting before any real money:

| Variable | Purpose |
| --- | --- |
| `MAX_SEND_KAS_PER_DAY`, `MAX_SEND_KAS_PER_TX` | Per user send limits. They cap the loss if an account is taken over. |
| `OPERATOR_MIN_RESERVE_KAS` | The admin gets a WhatsApp alert when the hot wallet falls below this. Sweeps are refused below it. |
| `COLD_WALLET_ADDRESS` | Destination of `/admin sweep`. Its seed must never be on the server. |
| `OP_SETTLE_MS` | How long an unconfirmed payment waits before it may be judged "never sent". Default 180000. |
| `MERCHANT_API_KEYS` | One key per merchant, `name:key,name2:key2`. |

## 3. Run

    npm install
    npm test          # build, then run the tests
    npm start

Docker:

    docker build -t kasapp .
    docker run --env-file .env -p 3000:3000 kasapp

Health endpoints: `GET /health` (process is up) and `GET /ready` (MongoDB and Redis reachable, else 503). Use `/health` for platform health checks.

## 4. Upgrading an existing database

Take a backup first. Both commands are dry runs until you add `--apply`.

    npm run migrate:balances
    npm run migrate:seeds
    npm run migrate:balances -- --apply
    npm run migrate:seeds -- --apply

## 5. Render (free tier, good for testing)

1. Push the repo to GitHub.
2. Create a MongoDB Atlas cluster and a Render Key Value (Redis) instance. Use their connection strings for `MONGODB_URI` and `REDIS_URL`.
3. In Render choose New, Web Service, pick the repo, runtime Docker, instance type Free.
4. Set the health check path to `/health`.
5. Add every variable from `.env.example` under Environment.
6. Deploy and read the logs. The server prints which variable is wrong if it refuses to start.
7. In the Meta developer dashboard set the webhook URL to `https://<your-service>.onrender.com/api/whatsapp`, the verify token to your `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.

The free tier sleeps after about 15 minutes without traffic. The first message after that is slow, and the reconciler and the subscription cron do not run while it sleeps. Use an always on instance for anything real.

## 6. Testnet checklist (do this before mainnet)

1. `KASPA_NETWORK=testnet-10`, a `kaspatest:` operator address funded from a testnet faucet, `VTPASS_BASE_URL=https://sandbox.vtpass.com/api`, and sandbox or test keys for Paystack and Flutterwave. On a testnet the server refuses live provider settings.
2. Send a payment to another user and to an external address. Check balances and the transaction on a testnet explorer.
3. Crash test: send a payment, kill the process right after, restart. The payment must not repeat, and the operation must finish as confirmed.
4. Bill test: kill the process while a sandbox bill is in flight. After restart the bill must not be bought twice, and a failed bill must refund exactly once.
5. Voucher test: create and redeem a voucher, then try to redeem it again. The second attempt must be rejected.
6. Merchant test: call the merchant endpoint twice with the same code. The second call must return the same result, not a second payment. See `MERCHANT_API.md`.
7. Run two instances against the same database and confirm only one runs the subscription cron at a time.

## 7. Going to mainnet

1. Complete the testnet checklist with no failures.
2. Back up the database and `ENCRYPTION_KEY`.
3. Set `KASPA_NETWORK=mainnet`, a `kaspa:` operator address, live provider URLs and keys, and conservative send limits.
4. Fund the hot wallet with only a few days of payouts.
5. Start with small amounts and watch the logs and alerts for the first days.
6. Tag the release: `git tag v1.0.0` then `git push origin v1.0.0`.

## 8. Rollback

* Deploys are stateless. To roll back, redeploy the previous commit or image.
* The database changes (`balanceSompi`, `appliedRefs`, the `operations` collection) are additive and older code ignores them, so rolling back the code does not need a database restore. Keep the backup from step 4 anyway.
* Do not roll back while operations are open. Check that the `operations` collection has no documents in state `PENDING`, `SIGNED` or `CALLED` first.

## 9. Operations

* Anything the reconciler cannot decide is set to `NEEDS_REVIEW` and the admin gets a WhatsApp alert. Nothing is paid or refunded automatically from that state. Look the transaction up on a block explorer and resolve it by hand.
* `/admin stats`, `/admin withdraw [address] [amount]` and `/admin sweep [amount]` are available to the admin phone number.
