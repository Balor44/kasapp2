// src/wallet/kaspa.service.ts
import * as bip39 from 'bip39';
import * as kaspaWasm from 'kaspa-wasm';

const NETWORK = kaspaWasm.NetworkType.Testnet;
const KASPA_REST_API = 'https://api.kaspa.org';

// Kaspa's registered SLIP-44 derivation path (account 0, receive index 0)
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";

export const KaspaService = {

  // Interface matches every other chain's service: generateAddress() -> { publicKey, secret }.
  // "secret" here is the mnemonic phrase itself — that's the backup a user would
  // restore from. sendKAS() re-derives the actual signing key from it at send time.
  generateWallet: async (): Promise<{ publicKey: string; secret: string }> => {
    const mnemonic = bip39.generateMnemonic(); // 12-word phrase
    const address = deriveAddress(mnemonic);

    return {
      publicKey: address,
      secret: mnemonic, // the seed phrase — never expose in API responses, encrypt in DB
    };
  },

  getBalance: async (address: string): Promise<number> => {
    try {
      const res = await fetch('${KASPA_REST_API}' + '/addresses/' + address + '/balance');
      if (!res.ok) return 0;
      const data = await res.json();
      // 1 KAS = 100,000,000 sompi
      return (data.balance || 0) / 100000000;
    } catch (error) {
      console.error('Kaspa balance check failed:', error);
      return 0;
    }
  },

  sendKAS: async (fromMnemonic: string, toAddress: string, amount: number): Promise<string> => {
    // Build, sign, and broadcast a Kaspa transaction using the WASM SDK.
    // Kaspa is UTXO-based (like Bitcoin) — this requires:
    //   1. Fetching the sender's current UTXOs
    //   2. Constructing a transaction spending those UTXOs
    //   3. Signing — re-derive the spending PrivateKey from fromMnemonic using
    //      derivePrivateKey() below, then pass it to signTransaction()
    //      (per kaspa_wasm.d.ts, signer is PrivateKey[])
    //   4. Submitting to a node or the REST API's broadcast endpoint
    //
    // Exact createTransaction / submitTransaction method names still need
    // confirming against kaspa_wasm.d.ts once you're ready to implement this.

    throw new Error('sendKAS: wire in real UTXO transaction building once ready');
  },

};

// --- internal helpers ---

function derivePrivateKey(mnemonic: string) {
  const seedHex = bip39.mnemonicToSeedSync(mnemonic).toString('hex');
  const xprv = new kaspaWasm.XPrv(seedHex);
  const derivedXprv = xprv.derivePath(DERIVATION_PATH);
  const xprvString = derivedXprv.intoString('xprv');

  // XPrivateKey wraps the derived extended key string; receiveKey(0) gives
  // the actual spendable PrivateKey at that derivation index.
  const xPrivateKey = new kaspaWasm.XPrivateKey(xprvString, false, BigInt(0));
  return xPrivateKey.receiveKey(0);
}

function deriveAddress(mnemonic: string): string {
  const privateKey = derivePrivateKey(mnemonic);
  const keypair = privateKey.toKeypair();
  const address = keypair.toAddress(NETWORK);
  return address.toString();
}