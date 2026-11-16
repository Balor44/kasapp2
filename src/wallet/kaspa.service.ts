import * as bip39 from "bip39";
import WebSocket from "isomorphic-ws";
import { createRequire } from "module";


// 1. Shim the WebSocket globally FIRST.
(globalThis as any).WebSocket = WebSocket;


// 2. Bypass ESM hoisting and CJS wrapping using a dynamic require.
// This guarantees kaspa-wasm initializes AFTER the WebSocket is shimmed.
// @ts-ignore - Bypass TS compiler errors for dynamic import of CJS module in ESM context.
const customRequire = typeof require !== "undefined" ? require : createRequire(import.meta.url);
const rawKaspa = customRequire("kaspa-wasm");
const kaspa: typeof import("kaspa-wasm") = rawKaspa.default || rawKaspa;


import { encryptMnemonic, decryptMnemonic } from "../utils/crypto.utils";
import { kasToSompi, MAX_SOMPI } from "../utils/sompi";
import { NetworkMismatchError, addressMatchesNetwork, addressPrefixFor, networksMatch } from "../utils/network";
import { NotSubmittedError, UnknownSubmitError } from "../utils/chainErrors";


const NETWORK = process.env.KASPA_NETWORK || "mainnet";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";


// Default priority fee in Sompi (1 KAS = 100,000,000 Sompi).
// 10,000 Sompi = 0.0001 KAS (ensures rapid inclusion by mainnet validators)
const DEFAULT_PRIORITY_FEE = BigInt(process.env.KASPA_PRIORITY_FEE_SOMPI || "10000");


/**
 * Opens an RPC connection and verifies, before anything else happens, that the node is on the
 * same network the app is configured for. A mismatch throws NetworkMismatchError, so no balance
 * is read and no transaction is built against the wrong network.
 */
async function connectRpc(options: { requireSynced?: boolean } = {}): Promise<any> {
  const url = process.env.KASPA_RPC_URL || "ws://127.0.0.1:16110";
  
  // kaspa-wasm v2 signature: constructor(url: string, encoding: number, network_type?: string)
  // encoding 1 = Borsh
  const rpc = new kaspa.RpcClient(url, 1, NETWORK);
  await rpc.connect({});


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


/** Hooks that let the caller record what is about to be broadcast, before it is broadcast. */
export interface SendHooks {
  onBeforeSubmit?: (info: { txid: string; inputs: string[] }) => Promise<void>;
}


export type PaymentCheck = "PAID" | "SEEN_NOT_PAYING" | "NOT_FOUND" | "UNKNOWN";
export type InputsCheck = "ALL_UNSPENT" | "SOME_SPENT" | "ALL_SPENT" | "UNKNOWN";


function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}


function outpointOf(entry: any): { txid: string; index: number } | null {
  const outpoint = entry?.outpoint ?? entry?.utxoEntry?.outpoint ?? entry?.entry?.outpoint;
  if (!outpoint || outpoint.transactionId === undefined || outpoint.index === undefined) return null;
  return { txid: String(outpoint.transactionId), index: Number(outpoint.index) };
}


function amountOf(entry: any): bigint {
  const amount = entry?.utxoEntry ? entry.utxoEntry.amount : entry?.amount;
  return BigInt(amount || 0);
}


function collectInputs(pending: any): string[] {
  try {
    const entries: any[] = typeof pending.getUtxoEntries === "function" ? pending.getUtxoEntries() : [];
    const keys: string[] = [];
    for (const entry of entries) {
      const o = outpointOf(entry);
      if (o) keys.push(`${o.txid}:${o.index}`);
    }
    return keys;
  } catch {
    return [];
  }
}


function outputAddress(output: any): string | undefined {
  // Rusty Kaspa v2 always provides the string address natively in verboseData
  const verbose = output?.verboseData?.scriptPublicKeyAddress;
  if (verbose) return String(verbose);
  return undefined;
}


function outputsPay(outputs: any[] | undefined, toAddress: string, amountSompi: bigint): boolean {
  const wanted = toAddress.trim().toLowerCase();
  return (outputs || []).some((output) => {
    const address = outputAddress(output);
    return !!address && address.toLowerCase() === wanted && BigInt(output.value ?? 0) >= amountSompi;
  });
}


async function fetchUtxos(rpc: any, address: string): Promise<any[]> {
  const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });
  return (entries as any[]) || [];
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


  verifyNetwork: async (): Promise<string> => {
    const rpc = await connectRpc();
    try {
      await rpc.disconnect();
    } catch {}
    return NETWORK;
  },


  getBalanceSompi: async (address: string): Promise<bigint> => {
    const rpc = await connectRpc();
    try {
      const entries = await fetchUtxos(rpc, address);
      return entries.reduce((sum: bigint, utxo: any) => sum + amountOf(utxo), BigInt(0));
    } finally {
      try {
        await rpc.disconnect();
      } catch {}
    }
  },


  getBalance: async (address: string): Promise<number> => {
    return Number(await KaspaService.getBalanceSompi(address)) / 100000000;
  },


  sendSompi: async (
    fromMnemonic: string,
    toAddress: string,
    amountSompi: bigint,
    hooks: SendHooks = {},
    priorityFeeSompi: bigint = DEFAULT_PRIORITY_FEE
  ): Promise<{ txid: string; txids: string[] }> => {
    if (typeof amountSompi !== "bigint" || amountSompi <= 0n || amountSompi > MAX_SOMPI) {
      throw new NotSubmittedError("Invalid transaction amount.", "INVALID_AMOUNT");
    }
    if (!addressMatchesNetwork(toAddress, NETWORK)) {
      const label = NETWORK === "mainnet" ? "Mainnet" : NETWORK;
      throw new NotSubmittedError(
        `Invalid address format. ${label} addresses must start with '${addressPrefixFor(NETWORK)}:'.`,
        "INVALID_ADDRESS"
      );
    }


    let senderAddress: string;
    let privateKey: any;
    try {
      let rawMnemonic = fromMnemonic.trim();
      if (!rawMnemonic.includes(" ") && process.env.ENCRYPTION_KEY) {
        try {
          rawMnemonic = decryptMnemonic(rawMnemonic, process.env.ENCRYPTION_KEY);
        } catch {}
      }
      senderAddress = deriveAddress(rawMnemonic);
      privateKey = derivePrivateKey(rawMnemonic);
    } catch (err) {
      throw new NotSubmittedError(`Could not read the signing key: ${errorMessage(err)}`, "KEY_ERROR");
    }


    let rpc: any;
    try {
      rpc = await connectRpc({ requireSynced: true });
    } catch (err) {
      const reason = err instanceof NetworkMismatchError ? "NETWORK_MISMATCH" : "NODE_NOT_READY";
      throw new NotSubmittedError(errorMessage(err), reason, reason !== "NETWORK_MISMATCH");
    }


    const txids: string[] = [];
    let anySubmitted = false;
    try {
      let entries: any[];
      try {
        entries = await fetchUtxos(rpc, senderAddress);
      } catch (err) {
        throw new NotSubmittedError(`Could not read wallet funds: ${errorMessage(err)}`, "NODE_NOT_READY", true);
      }


      if (!entries || !entries.length) {
        throw new NotSubmittedError("Wallet has no spendable UTXOs.", "INSUFFICIENT_FUNDS");
      }


      let generator: any;
      try {
        // Cast args to any to bypass strict TS matching errors on the new bindings
        const genArgs: any = {
          entries,
          outputs: [{ address: toAddress, amount: amountSompi }],
          changeAddress: senderAddress,
          priorityFee: priorityFeeSompi,
          networkId: NETWORK,
        };
        generator = new kaspa.Generator(genArgs);
      } catch (err) {
        throw new NotSubmittedError(errorMessage(err), "BUILD_FAILED");
      }


      for (;;) {
        let pending: any;
        try {
          pending = await generator.next();
        } catch (err) {
          const message = errorMessage(err);
          const reason = /insufficient|not enough|storage mass|funds/i.test(message) ? "INSUFFICIENT_FUNDS" : "BUILD_FAILED";
          if (anySubmitted) throw new UnknownSubmitError(message);
          throw new NotSubmittedError(message, reason);
        }
        if (!pending) break;


        try {
          pending.sign([privateKey]);
        } catch (err) {
          if (anySubmitted) throw new UnknownSubmitError(errorMessage(err));
          throw new NotSubmittedError(`Signing failed: ${errorMessage(err)}`, "KEY_ERROR");
        }


        const txid: string | undefined = pending.id;
        if (!txid) {
          if (anySubmitted) throw new UnknownSubmitError("Could not determine the transaction id.");
          throw new NotSubmittedError("Could not determine the transaction id before broadcast.", "BUILD_FAILED");
        }


        if (hooks.onBeforeSubmit) {
          try {
            await hooks.onBeforeSubmit({ txid, inputs: collectInputs(pending) });
          } catch (err) {
            if (anySubmitted) throw new UnknownSubmitError(`Write ahead record failed: ${errorMessage(err)}`);
            throw new NotSubmittedError(`Write ahead record failed: ${errorMessage(err)}`, "RECORD_FAILED", true);
          }
        }


        txids.push(txid);
        anySubmitted = true;
        try {
          const returned = await pending.submit(rpc);
          if (returned && returned !== txid) {
            console.warn(`[Kaspa] Node returned a different transaction id (${returned}) than the signed one (${txid}).`);
          }
        } catch (err) {
          throw new UnknownSubmitError(`Broadcast result unknown: ${errorMessage(err)}`);
        }
      }


      if (!txids.length) {
        throw new NotSubmittedError("Nothing to send.", "BUILD_FAILED");
      }


      return { txid: txids[txids.length - 1], txids };
    } finally {
      try {
        await rpc.disconnect();
      } catch {}
    }
  },


  checkPayment: async (txid: string, toAddress: string, amountSompi: bigint): Promise<PaymentCheck> => {
    let rpc: any;
    try {
      rpc = await connectRpc();
    } catch {
      return "UNKNOWN";
    }
    try {
      try {
        const { mempoolEntry } = await rpc.getMempoolEntry({
          transactionId: txid,
          includeOrphanPool: false,
          filterTransactionPool: false,
        });
        if (mempoolEntry && !mempoolEntry.isOrphan) {
          return outputsPay((mempoolEntry.transaction as any).outputs, toAddress, amountSompi) ? "PAID" : "SEEN_NOT_PAYING";
        }
      } catch (err) {
        if (!/not found|no such|does not exist|doesn't exist|unknown transaction|not in mempool/i.test(errorMessage(err))) {
          return "UNKNOWN";
        }
      }


      const entries = await fetchUtxos(rpc, toAddress);
      for (const entry of entries) {
        const o = outpointOf(entry);
        if (o && o.txid === txid) {
          return amountOf(entry) >= amountSompi ? "PAID" : "SEEN_NOT_PAYING";
        }
      }
      return "NOT_FOUND";
    } catch {
      return "UNKNOWN";
    } finally {
      try {
        await rpc.disconnect();
      } catch {}
    }
  },


  checkInputs: async (fromAddress: string, inputs: string[]): Promise<InputsCheck> => {
    if (!inputs.length) return "UNKNOWN";
    let rpc: any;
    try {
      rpc = await connectRpc();
    } catch {
      return "UNKNOWN";
    }
    try {
      const present = new Set<string>();
      for (const entry of await fetchUtxos(rpc, fromAddress)) {
        const o = outpointOf(entry);
        if (o) present.add(`${o.txid}:${o.index}`);
      }
      const unspent = inputs.filter((key) => present.has(key)).length;
      if (unspent === inputs.length) return "ALL_UNSPENT";
      if (unspent === 0) return "ALL_SPENT";
      return "SOME_SPENT";
    } catch {
      return "UNKNOWN";
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
    const sompiAmount = kasToSompi(amount);
    const { txid } = await KaspaService.sendSompi(fromMnemonic, toAddress, sompiAmount, {}, priorityFeeSompi);
    return txid;
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


      let rawMnemonic = senderEncryptedMnemonic.trim();
      if (!rawMnemonic.includes(" ")) {
        rawMnemonic = decryptMnemonic(senderEncryptedMnemonic, encryptionKey);
      }


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
  const xprv: any = new kaspa.XPrv(seed).derivePath(DERIVATION_PATH);
  return xprv.privateKey || (typeof xprv.toPrivateKey === 'function' ? xprv.toPrivateKey() : xprv);
}


function deriveAddress(mnemonic: string): string {
  const privateKey = derivePrivateKey(mnemonic);
  const keypair = privateKey.toKeypair();
  return keypair.toAddress(NETWORK).toString();
}


