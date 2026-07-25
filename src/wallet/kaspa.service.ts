// src/wallet/kaspa.service.ts

import * as bip39 from "bip39";
import WebSocket from "isomorphic-ws";
(globalThis as any).WebSocket = WebSocket;

import * as kaspa from "kaspa-wasm";

const NETWORK = "testnet-10";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";

export const KaspaService = {

generateWallet: async (): Promise<{ publicKey: string; secret: string }> => {
const mnemonic = bip39.generateMnemonic();
const address = deriveAddress(mnemonic);

return {
publicKey: address,
secret: mnemonic,
};
},

getBalance: async (address: string): Promise<number> => {
let rpc: any;
try {
const resolver = new kaspa.Resolver();
rpc = await resolver.connect({
network_id: NETWORK,
encoding: "borsh",
} as any);

const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });

const totalSompi = entries.reduce(
(sum: bigint, utxo: any) => sum + BigInt(utxo.amount),
BigInt(0)
);

return Number(totalSompi) / 100000000;
} catch (err) {
console.error("Kaspa balance error:", err);
return 0;
} finally {
if (rpc) await rpc.disconnect();
}
},

sendKAS: async (
fromMnemonic: string,
toAddress: string,
amount: number
): Promise<string> => {
const senderAddress = deriveAddress(fromMnemonic);
const privateKey = derivePrivateKey(fromMnemonic);

const resolver = new kaspa.Resolver();
const rpc = await resolver.connect({
    network_id: NETWORK,
    encoding: "borsh",
} as any);

try {
const { entries } = await rpc.getUtxosByAddresses({
addresses: [senderAddress],
});

if (!entries.length) {
throw new Error("Wallet has no spendable UTXOs.");
}

const generator = new kaspa.Generator({
entries,
outputs: [
{
address: toAddress,
amount: BigInt(Math.round(amount * 100000000)),
},
],
changeAddress: senderAddress,
priorityFee: BigInt(0),
networkId: NETWORK,
});

let txid = "";

while (true) {
  const pending = await generator.next();
  if (!pending) break;

  const utxoEntries = pending.getUtxoEntries();
  for (let i = 0; i < utxoEntries.length; i++) {
    pending.signInput(i, privateKey);
  }

  txid = await pending.submit(rpc);
}

return txid;
} finally {
await rpc.disconnect();
}
},

};

// ---------------- Helpers ----------------

function derivePrivateKey(mnemonic: string): any {
const seed = bip39.mnemonicToSeedSync(mnemonic).toString("hex");
return new kaspa.XPrv(seed).derivePath(DERIVATION_PATH).toPrivateKey();
}

function deriveAddress(mnemonic: string): string {
const privateKey = derivePrivateKey(mnemonic);
const keypair = privateKey.toKeypair();
return keypair.toAddress(NETWORK).toString();
}
