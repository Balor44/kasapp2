// src/wallet/kaspa.service.ts


import * as bip39 from "bip39";
import WebSocket from "isomorphic-ws";
(globalThis as any).WebSocket = WebSocket;


import * as kaspa from "kaspa-wasm";
import { decryptMnemonic } from "../utils/crypto.utils";


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


  /**
   * Wrapper for ChatbotService to send KAS to external Kaspa addresses.
   * Decrypts mnemonic and executes sendKAS via kaspa-wasm.
   */
  sendExternalTransaction: async (
    senderEncryptedMnemonic: string,
    recipientAddress: string,
    amountKas: number
  ): Promise<{ success: boolean; txId?: string; error?: string }> => {
    try {
      // 1. Decrypt user's mnemonic seed phrase
      const rawMnemonic = decryptMnemonic(
        senderEncryptedMnemonic,
        process.env.ENCRYPTION_KEY || ""
      );


      // 2. Validate prefix matches current network mode
      const isMainnet = recipientAddress.toLowerCase().startsWith("kaspa:");
      const isTestnet = recipientAddress.toLowerCase().startsWith("kasptest:");


      if (!isMainnet && !isTestnet) {
        return {
          success: false,
          error: "Invalid Kaspa address format. Address must start with 'kaspa:' or 'kasptest:'.",
        };
      }


      // 3. Broadcast transaction using kaspa-wasm RPC generator
      const txId = await KaspaService.sendKAS(rawMnemonic, recipientAddress, amountKas);


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