import { UserModel } from "../../models/User";
import { KaspaService } from "../../wallet/kaspa.service";
import { getOperatorSeed } from "../../utils/operator";
import { log } from "../../utils/logger";
import { ledger } from "../ledger.mongo";
import { createEngine } from "./engine";
import { mongoOpStore } from "./store";
import { billProvider } from "./billProvider";
import { Chain } from "./types";
import { raiseAlert } from "../alert.service";

/** "operator" or "user:<mongo id>". Seeds are resolved here, at the last moment, and never stored in operations. */
async function resolveSeed(wallet: string): Promise<string> {
  if (wallet === "operator") return getOperatorSeed();
  if (wallet.startsWith("user:")) {
    const user = await UserModel.findById(wallet.slice(5)).select("mnemonic");
    if (!user) throw new Error("Wallet owner not found.");
    return user.mnemonic;
  }
  throw new Error("Unknown wallet reference.");
}

const chain: Chain = {
  async sendSompi(fromWallet, toAddress, amountSompi, hooks) {
    return KaspaService.sendSompi(await resolveSeed(fromWallet), toAddress, amountSompi, hooks);
  },
  checkPayment: (txid, to, amount) => KaspaService.checkPayment(txid, to, amount),
  checkInputs: (from, inputs) => KaspaService.checkInputs(from, inputs),
};

export const engine = createEngine({
  store: mongoOpStore,
  chain,
  provider: billProvider,
  credit: (userId, sompi, ref) => ledger.credit(userId, sompi, ref),
  settleMs: Number(process.env.OP_SETTLE_MS || 180_000),
  /**
   * Money goes back only when an operation is FAILED, which the engine reaches only on proof
   * (provider said failed, or chain shows the payment never left). Credited once per operation key.
   */
  onRefund: async (op) => {
    const { refundUserId, refundSompi } = op.params || {};
    if (!refundUserId || !refundSompi) return;
    const r = await ledger.credit(String(refundUserId), BigInt(refundSompi), `refund:${op.key}`);
    log.info("refund applied", { op: op.key, result: r });
  },
  alert: (message, op) => { void raiseAlert(`${message} (op ${op.key}, ${op.state})`); },
});

export { startReconciler } from "./reconciler";
