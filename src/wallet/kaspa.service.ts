import * as bip39 from "bip39";
import WebSocket from "isomorphic-ws";
(globalThis as any).WebSocket = WebSocket;


import * as kaspa from "kaspa-wasm";
import { encryptMnemonic, decryptMnemonic } from "../utils/crypto.utils";


const NETWORK = process.env.KASPA_NETWORK || "mainnet";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";


// Default priority fee in Sompi (1 KAS = 100,000,000 Sompi). 
// 10,000 Sompi = 0.0001 KAS (ensures rapid inclusion by mainnet validators)
const DEFAULT_PRIORITY_FEE = BigInt(process.env.KASPA_PRIORITY_FEE_SOMPI || "10000");


export const KaspaService = {
  generateWallet: async (): Promise<{ publicKey: string; secret: string }> => {
    const mnemonic = bip39.generateMnemonic();
    const address = deriveAddress(mnemonic);


    return {
      publicKey: address,
      secret: mnemonic,
    };
  },


  createEncryptedWallet: async (): Promise<{ address: string; encryptedSeed: string }> => {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("[KaspaService] Cannot create encrypted wallet: ENCRYPTION_KEY is not defined in environment.");
    }


    const { publicKey, secret } = await KaspaService.generateWallet();
    const encryptedSeed = encryptMnemonic(secret, encryptionKey);


    return {
      address: publicKey,
      encryptedSeed,
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


      const totalSompi = entries.reduce((sum: bigint, utxo: any) => {
        const amount = utxo.utxoEntry ? utxo.utxoEntry.amount : utxo.amount;
        return sum + BigInt(amount || 0);
      }, BigInt(0));


      return Number(totalSompi) / 100000000;
    } catch (err) {
      console.error("[Kaspa Balance Error]:", err);
      return 0;
    } finally {
      if (rpc) {
        try {
          await rpc.disconnect();
        } catch {}
      }
    }
  },


  sendKAS: async (
    fromMnemonic: string,
    toAddress: string,
    amount: number | string,
    priorityFeeSompi: bigint = DEFAULT_PRIORITY_FEE
  ) => {
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


      if (!entries || !entries.length) {
        throw new Error("Wallet has no spendable UTXOs.");
      }


      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid transaction amount.");
      }
      const sompiAmount = BigInt(Math.round(numericAmount * 100000000));


      const generator = new kaspa.Generator({
        entries,
        outputs: [
          {
            address: toAddress,
            amount: sompiAmount,
          },
        ],
        changeAddress: senderAddress,
        priorityFee: priorityFeeSompi,
        networkId: NETWORK,
      });


      let txid = "";


      while (true) {
        const pending = await generator.next();
        if (!pending) break;


        pending.sign([privateKey]);
        txid = await pending.submit(rpc);
      }


      return txid;
    } finally {
      try {
        await rpc.disconnect();
      } catch {}
    }
  },


  sendExternalTransaction: async (
    senderEncryptedMnemonic: string,
    recipientAddress: string,
    amountKas: number | string,
    priorityFeeSompi?: bigint
  ): Promise<{ success: boolean; txId?: string; error?: string }> => {
    try {
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error("ENCRYPTION_KEY is missing from environment.");
      }


      const rawMnemonic = decryptMnemonic(senderEncryptedMnemonic, encryptionKey);


      const isMainnet = recipientAddress.toLowerCase().startsWith("kaspa:");
      if (!isMainnet && NETWORK === "mainnet") {
        return {
          success: false,
          error: "Invalid address format. Mainnet addresses must start with 'kaspa:'.",
        };
      }


      const txId = await KaspaService.sendKAS(
        rawMnemonic,
        recipientAddress,
        amountKas,
        priorityFeeSompi || DEFAULT_PRIORITY_FEE
      );


      console.log(`[Kaspa On-Chain TX] Sent ${amountKas} KAS to ${recipientAddress} | TXID: ${txId}`);


      return {
        success: true,
        txId,
      };
    } catch (error: any) {
      console.error("[Kaspa On-Chain TX Error]:", error);
      return {
        success: false,
        error: error?.message || "Failed to broadcast on-chain Kaspa transaction.",
      };
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


