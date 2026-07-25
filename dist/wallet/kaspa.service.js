"use strict";
// src/wallet/kaspa.service.ts
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
const NETWORK = "testnet-10";
const DERIVATION_PATH = "m/44'/111111'/0'/0/0";
exports.KaspaService = {
    generateWallet: async () => {
        const mnemonic = bip39.generateMnemonic();
        const address = deriveAddress(mnemonic);
        return {
            publicKey: address,
            secret: mnemonic,
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
            const totalSompi = entries.reduce((sum, utxo) => sum + BigInt(utxo.amount), BigInt(0));
            return Number(totalSompi) / 100000000;
        }
        catch (err) {
            console.error("Kaspa balance error:", err);
            return 0;
        }
        finally {
            if (rpc)
                await rpc.disconnect();
        }
    },
    sendKAS: async (fromMnemonic, toAddress, amount) => {
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
                if (!pending)
                    break;
                const signedTx = kaspa.signTransaction(pending.transaction, [privateKey], true);
                pending.transaction = signedTx;
                txid = await pending.submit(rpc);
            }
            return txid;
        }
        finally {
            await rpc.disconnect();
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
