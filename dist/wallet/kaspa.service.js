"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KaspaService = void 0;
const bip39 = __importStar(require("bip39"));
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
globalThis.WebSocket = isomorphic_ws_1.default;
const kaspa = __importStar(require("kaspa-wasm"));
const crypto_utils_1 = require("../utils/crypto.utils");
const NETWORK = process.env.KASPA_NETWORK || "mainnet";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";
// Default priority fee in Sompi (1 KAS = 100,000,000 Sompi). 
// 10,000 Sompi = 0.0001 KAS (ensures rapid inclusion by mainnet validators)
const DEFAULT_PRIORITY_FEE = BigInt(process.env.KASPA_PRIORITY_FEE_SOMPI || "10000");
exports.KaspaService = {
    generateWallet: async () => {
        const mnemonic = bip39.generateMnemonic();
        const address = deriveAddress(mnemonic);
        return {
            publicKey: address,
            secret: mnemonic,
        };
    },
    createEncryptedWallet: async () => {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error("[KaspaService] Cannot create encrypted wallet: ENCRYPTION_KEY is not defined in environment.");
        }
        const { publicKey, secret } = await exports.KaspaService.generateWallet();
        const encryptedSeed = (0, crypto_utils_1.encryptMnemonic)(secret, encryptionKey);
        return {
            address: publicKey,
            encryptedSeed,
        };
    },
    getBalance: async (address) => {
        let rpc;
        try {
            const resolver = new kaspa.Resolver();
            rpc = await resolver.connect({
                network_id: NETWORK,
                encoding: "borsh",
            });
            const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });
            const totalSompi = entries.reduce((sum, utxo) => {
                const amount = utxo.utxoEntry ? utxo.utxoEntry.amount : utxo.amount;
                return sum + BigInt(amount || 0);
            }, BigInt(0));
            return Number(totalSompi) / 100000000;
        }
        catch (err) {
            console.error("[Kaspa Balance Error]:", err);
            return 0;
        }
        finally {
            if (rpc) {
                try {
                    await rpc.disconnect();
                }
                catch { }
            }
        }
    },
    sendKAS: async (fromMnemonic, toAddress, amount, priorityFeeSompi = DEFAULT_PRIORITY_FEE) => {
        const senderAddress = deriveAddress(fromMnemonic);
        const privateKey = derivePrivateKey(fromMnemonic);
        const resolver = new kaspa.Resolver();
        const rpc = await resolver.connect({
            network_id: NETWORK,
            encoding: "borsh",
        });
        try {
            const { entries } = await rpc.getUtxosByAddresses({
                addresses: [senderAddress],
            });
            if (!entries || !entries.length) {
                throw new Error("Wallet has no spendable UTXOs.");
            }
            // ===============================================================
            // 🛡️ LOOPHOLE 5 FIX: Strict 8-Decimal Floating Point Enforcement
            // ===============================================================
            const numericAmount = parseFloat(Number(amount).toFixed(8));
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
                if (!pending)
                    break;
                pending.sign([privateKey]);
                txid = await pending.submit(rpc);
            }
            return txid;
        }
        finally {
            try {
                await rpc.disconnect();
            }
            catch { }
        }
    },
    sendExternalTransaction: async (senderEncryptedMnemonic, recipientAddress, amountKas, priorityFeeSompi) => {
        try {
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error("ENCRYPTION_KEY is missing from environment.");
            }
            const rawMnemonic = (0, crypto_utils_1.decryptMnemonic)(senderEncryptedMnemonic, encryptionKey);
            const isMainnet = recipientAddress.toLowerCase().startsWith("kaspa:");
            if (!isMainnet && NETWORK === "mainnet") {
                return {
                    success: false,
                    error: "Invalid address format. Mainnet addresses must start with 'kaspa:'.",
                };
            }
            const txId = await exports.KaspaService.sendKAS(rawMnemonic, recipientAddress, amountKas, priorityFeeSompi || DEFAULT_PRIORITY_FEE);
            console.log(`[Kaspa On-Chain TX] Sent ${amountKas} KAS to ${recipientAddress} | TXID: ${txId}`);
            return {
                success: true,
                txId,
            };
        }
        catch (error) {
            console.error("[Kaspa On-Chain TX Error]:", error);
            return {
                success: false,
                error: error?.message || "Failed to broadcast on-chain Kaspa transaction.",
            };
        }
    },
};
// ---------------- Helpers ----------------
function derivePrivateKey(mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic).toString("hex");
    return new kaspa.XPrv(seed).derivePath(DERIVATION_PATH).toPrivateKey();
}
function deriveAddress(mnemonic) {
    const privateKey = derivePrivateKey(mnemonic);
    const keypair = privateKey.toKeypair();
    return keypair.toAddress(NETWORK).toString();
}
