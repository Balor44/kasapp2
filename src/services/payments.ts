import { UserModel } from "../models/User";
import { OperationModel } from "../models/Operation";
import { kasToSompi, formatKas } from "../utils/sompi";
import { currentMessageId } from "../utils/requestContext";
import { ledger } from "./ledger.mongo";
import { engine } from "./ops";
import { checkLimits, readLimits } from "./limits";
import { TERMINAL, Operation } from "./ops/types";

export type PaymentOutcome =
  | { status: "DONE"; op: Operation }
  | { status: "PENDING"; op: Operation } // outcome not known yet, the reconciler will settle it
  | { status: "REJECTED"; reason: "INSUFFICIENT" | "FAILED"; message?: string };

/** True while a user has money moving that has not been settled. Balance sync must not touch such users. */
export async function hasOpenOperations(userId: string): Promise<boolean> {
  const hit = await OperationModel.exists({ "params.refundUserId": userId, state: { $nin: TERMINAL } });
  return !!hit;
}

/**
 * KAS from a user's wallet to any address, exactly once per message.
 * The balance is reduced first (once), the payment runs as a logged operation, and the balance is
 * restored only if the payment is proven not to have left.
 */
export async function sendFromUser(user: any, toAddress: string, kas: number | string): Promise<PaymentOutcome> {
  const sompi = kasToSompi(kas);
  const key = `send:${user._id}:${currentMessageId()}`;

  // Withdrawal limits cap the damage if an account is taken over. A retry of the same message is exempt.
  const already = await engine_getExisting(key);
  if (!already) {
    const since = Date.now() - 24 * 3600 * 1000;
    const recent: any[] = await OperationModel.find({
      kind: "PAYOUT", "params.refundUserId": String(user._id), createdAt: { $gte: since }, state: { $ne: "FAILED" },
      key: /^send:/,
    }).select("params.amountSompi");
    const sentToday = recent.reduce((sum, o) => sum + BigInt(o.params?.amountSompi || "0"), 0n);
    const verdict = checkLimits(sompi, sentToday, readLimits());
    if (!verdict.ok) {
      const which = verdict.reason === "PER_TX" ? "per transaction" : "24 hour";
      return { status: "REJECTED", reason: "FAILED", message: `This is above your ${which} send limit of ${formatKas(verdict.limitSompi)} KAS.` };
    }
  }
  const debit = await ledger.debit(String(user._id), sompi, `debit:${key}`);
  if (debit === "INSUFFICIENT") return { status: "REJECTED", reason: "INSUFFICIENT" };

  const op = await engine.execute(key, "PAYOUT", {
    fromWallet: `user:${user._id}`,
    fromAddress: user.walletAddress || user.wallet,
    toAddress,
    amountSompi: sompi.toString(),
    refundUserId: String(user._id),
    refundSompi: sompi.toString(),
  });
  if (op.state === "CONFIRMED") return { status: "DONE", op };
  if (op.state === "FAILED") return { status: "REJECTED", reason: "FAILED", message: op.lastError };
  return { status: "PENDING", op };
}

/** Pays a Naira bill in KAS: user to operator on chain, then the provider, with an on chain refund if the provider fails. */
export async function payBillFromUser(
  user: any,
  requiredKas: number,
  bill: Record<string, any>
): Promise<PaymentOutcome> {
  const operator = process.env.OPERATOR_WALLET_ADDRESS || "";
  if (!operator) return { status: "REJECTED", reason: "FAILED", message: "Payments are temporarily unavailable." };
  const sompi = kasToSompi(requiredKas);
  const base = `billkas:${user._id}:${currentMessageId()}`;

  const debit = await ledger.debit(String(user._id), sompi, `debit:${base}`);
  if (debit === "INSUFFICIENT") return { status: "REJECTED", reason: "INSUFFICIENT" };

  const refundLeg = {
    kind: "PAYOUT" as const,
    key: `${base}:refund`,
    params: {
      fromWallet: "operator",
      fromAddress: operator,
      toAddress: user.walletAddress || user.wallet,
      amountSompi: sompi.toString(),
      next: { CONFIRMED: { kind: "CREDIT" as const, key: `credit:${base}:refund`, userId: String(user._id), sompi: sompi.toString() } },
    },
  };
  const billLeg = { kind: "BILL" as const, key: `${base}:bill`, params: { ...bill, next: { FAILED: refundLeg } } };

  const pay = await engine.execute(`${base}:pay`, "PAYOUT", {
    fromWallet: `user:${user._id}`,
    fromAddress: user.walletAddress || user.wallet,
    toAddress: operator,
    amountSompi: sompi.toString(),
    refundUserId: String(user._id), // leg one failing means the money never left: restore the balance
    refundSompi: sompi.toString(),
    next: { CONFIRMED: billLeg },
  });
  if (pay.state === "FAILED") return { status: "REJECTED", reason: "FAILED", message: pay.lastError };
  if (pay.state !== "CONFIRMED") return { status: "PENDING", op: pay };

  const billOp = (await engine.execute(billLeg.key, "BILL", billLeg.params)) as Operation;
  if (billOp.state === "DELIVERED") return { status: "DONE", op: billOp };
  if (billOp.state === "FAILED") return { status: "REJECTED", reason: "FAILED", message: "The provider could not complete the payment. Your KAS is being returned to your wallet." };
  return { status: "PENDING", op: billOp };
}

export async function freshBalanceKas(userId: string): Promise<string> {
  const u: any = await UserModel.findById(userId);
  const { userBalanceSompi } = await import("../utils/balance");
  return u ? formatKas(userBalanceSompi(u), 4) : "0.0000";
}


async function engine_getExisting(key: string): Promise<boolean> {
  return !!(await OperationModel.exists({ key }));
}
