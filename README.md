# Kasapp - WhatsApp-Native Payments and Utility Engine for Africa


Kasapp is a decentralized payment gateway and voucher system built directly into WhatsApp. Designed to drive grassroots adoption of the Kaspa network across Africa, it completely removes the steep learning curve of traditional Web3 wallets. By combining a familiar chat interface with a robust Merchant API, Kasapp allows everyday users to securely manage, send, and spend real KAS instantly.


## Why Kasapp?
The primary friction point for new blockchain users is wallet complexity. Kasapp solves this by turning WhatsApp into a secure, non-custodial Kaspa wallet. This empowers local educational initiatives, ecosystem builders, and everyday users to seamlessly connect with Web3 storefronts and point-of-sale systems without downloading additional apps.


## Core Features


*   **WhatsApp-First Onboarding:** Automatically generates and securely encrypts non-custodial Kaspa wallets for users directly within their chat interface.
*   **Smart Voucher System:** Users can generate redeemable KAS vouchers powered by deterministic escrow vault addresses, allowing them to send value via simple, shareable codes.
*   **High-Value Security Lock (Argent 2FA):** Built-in covenant security threshold. Any transaction of 10,000 KAS or more automatically locks and requires a secondary master PIN to execute, protecting user funds.
*   **Merchant POS API:** Dedicated, authenticated endpoints (`/api/v1/merchant/redeem`) that allow local businesses to instantly verify voucher codes and accept KAS payments.
*   **Strict Mainnet Routing:** Enforced `kaspa:` prefix validation and secure WASM bindings ensuring safe, production-ready on-chain transactions.


## Tech Stack
*   **Backend:** Node.js, Express, TypeScript
*   **Database:** MongoDB (with cryptographic seed encryption)
*   **Kaspa Integration:** `@dfns/kaspa-wasm` for core RPC and UTXO management
*   **Interface:** WhatsApp Webhook Integration


## Quick Start Guide


**1. Prerequisites**
*   Node.js (v18+ recommended)
*   MongoDB instance (local or Atlas)


**2. Installation**
Clone the repository and install the dependencies:
```bash
git clone [https://github.com/yourusername/kasapp.git](https://github.com/yourusername/kasapp.git)
cd kasapp
npm install
```

**3. Environment Setup**
Copy the template environment file and fill in your specific details (database URI, encryption keys, and 2FA PIN):


```Bash
cp .env.example .env
```

**4. Running the Server**
For development:


```Bash
npm run dev
```

For production:

``` Bash
npm run build
npm start
```

## Security Note
This infrastructure handles real KAS on mainnet. Ensure your ENCRYPTION_KEY and MERCHANT_API_KEY in the .env file are sufficiently long, secure, and never committed to version control.


License
MIT