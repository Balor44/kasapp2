import * as bip39 from "bip39";
import WebSocket from "isomorphic-ws";
(globalThis as any).WebSocket = WebSocket;


import * as kaspa from "kaspa-wasm";
import { encryptMnemonic, decryptMnemonic } from "../utils/crypto.utils";
import { kasToSompi } from "../utils/sompi";
import { NetworkMismatchError, addressMatchesNetwork, addressPrefixFor, networksMatch } from "../utils/network";


const NETWORK = process.env.KASPA_NETWORK || "mainnet";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";


// Default priority fee in Sompi (1 KAS = 100,000,000 Sompi).
// 10,000 Sompi = 0.0001 KAS (ensures rapid inclusion by mainnet validators)
const DEFAULT_PRIORITY_FEE = BigInt(process.env.KASPA_PRIORITY_FEE_SOMPI || "10000");


/**
 * Opens an RPC connection and verifies, before anything else happens, that the node is on the
 * same network the app is configured for. A mismatch throws NetworkMismatchError, so no balance
 * is read and no transaction is built against the wrong network.
 *
 * The resolver option is `networkId` (camelCase) as defined by kaspa-wasm. The previous code
 * passed `network_id`, which the library does not read, so KASPA_NETWORK was not applied to the
 * RPC connection.
 */
async function connectRpc(options: { requireSynced?: boolean } = {}): Promise<kaspa.RpcClient> {
  const resolver = new kaspa.Resolver();
  const rpc = await resolver.connect({
    networkId: NETWORK,
    encoding: "borsh",
  });

  try {
    const info = await rpc.getServerInfo();

    if (!networksMatch(NETWORK, info.networkId)) {
      throw new NetworkMismatchError(
        `Network mismatch: the app is configured for "${NETWORK}" but the connected node reports "${info.networkId}". Refusing to continue.`
      );
    }

    if (options.requireSynced && !info.isSynced) {
      throw new Error("The connected Kaspa node is still syncing. Please try again in a moment.");
    }

    return rpc;
  } catch (err) {
    try {
      await rpc.disconnect();
    } catch {}
    throw err;
  }
}


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


  /**
   * Confirms the configured network matches the node. Throws NetworkMismatchError on a mismatch.
   * Any other error (for example the node being unreachable) is thrown as a normal Error.
   */
  verifyNetwork: async (): Promise<string> => {
    const rpc = await connectRpc();
    try {
      await rpc.disconnect();
    } catch {}
    return NETWORK;
  },


  /**
   * Returns the on-chain balance in KAS.
   * Throws if the network cannot be reached or is the wrong network. It never returns 0 to
   * mean "unknown", because callers (ledger sync, invoices, send checks) treat the value as truth.
   */
  getBalance: async (address: string): Promise<number> => {
    const rpc = await connectRpc();
    try {
      const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });


      const totalSompi = entries.reduce((sum: bigint, utxo: any) => {
        const amount = utxo.utxoEntry ? utxo.utxoEntry.amount : utxo.amount;
        return sum + BigInt(amount || 0);
      }, BigInt(0));


      return Number(totalSompi) / 100000000;
    } finally {
      try {
        await rpc.disconnect();
      } catch {}
    }
  },


  sendKAS: async (
    fromMnemonic: string,
    toAddress: string,
    amount: number | string,
    priorityFeeSompi: bigint = DEFAULT_PRIORITY_FEE
  ) => {
    // Auto-detect if fromMnemonic is an encrypted cipher or plaintext mnemonic
    let rawMnemonic = fromMnemonic.trim();
    if (!rawMnemonic.includes(" ") && process.env.ENCRYPTION_KEY) {
      try {
        rawMnemonic = decryptMnemonic(rawMnemonic, process.env.ENCRYPTION_KEY);
      } catch {
        // Fall back to as-is if already decrypted
      }
    }


    // Exact integer sompi amount (throws "Invalid transaction amount." before any network call)
    const sompiAmount = kasToSompi(amount);


    const senderAddress = deriveAddress(rawMnemonic);
    const privateKey = derivePrivateKey(rawMnemonic);


    // Sends also require a synced node, so UTXO data is current.
    const rpc = await connectRpc({ requireSynced: true });


    try {
      const { entries } = await rpc.getUtxosByAddresses({
        addresses: [senderAddress],
      });


      if (!entries || !entries.length) {
        throw new Error("Wallet has no spendable UTXOs.");
      }


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


      // Bypass decryption if mnemonic has spaces (plaintext operator phrase)
      let rawMnemonic = senderEncryptedMnemonic.trim();
      if (!rawMnemonic.includes(" ")) {
        rawMnemonic = decryptMnemonic(senderEncryptedMnemonic, encryptionKey);
      }


      // The destination must belong to the network the app is configured for.
      if (!addressMatchesNetwork(recipientAddress, NETWORK)) {
        const expectedPrefix = addressPrefixFor(NETWORK) + ":";
        const label = NETWORK === "mainnet" ? "Mainnet" : NETWORK;
        return {
          success: false,
          error: `Invalid address format. ${label} addresses must start with '${expectedPrefix}'.`,
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
