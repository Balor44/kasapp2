import { RechargeCardModel } from "../models/RechargeCard";
import { kasToSompi } from "../utils/sompi";
import { log } from "../utils/logger";
import { ledger } from "./ledger.mongo";
import { UserModel } from "../models/User";
import { engine } from "./ops";
import { generateVoucherCode } from "../utils/voucherCode";
import { currentMessageId } from "../utils/requestContext";
import { Operation } from "./ops/types";

/**
 * Redeeming a voucher is a small state machine so a crash can never lose or duplicate money:
 *   UNUSED  -> (atomic claim) used:true, usedBy -> (exactly once credit via ledger ref) -> creditedAt set
 * The credit is keyed by "voucher:<code>", so retrying it any number of times credits once.
 */
export async function redeemToUser(code: string, phone: string): Promise<{ status: "OK" | "INVALID" | "NO_USER"; creditedSompi?: bigint }> {
  const user = await UserModel.findOne({ phone });
  if (!user) return { status: "NO_USER" };

  const card = await RechargeCardModel.findOneAndUpdate(
    { code, used: false },
    { $set: { used: true, usedBy: phone, usedAt: new Date(), claimState: "CLAIMED" } },
    { new: true }
  );
  if (!card) return { status: "INVALID" };

  const sompi = kasToSompi(card.amount);
  await ledger.credit(String(user._id), sompi, `voucher:${card.code}`);
  await RechargeCardModel.updateOne({ _id: card._id }, { $set: { creditedAt: new Date() } });
  return { status: "OK", creditedSompi: sompi };
}

/** Finishes credits for vouchers that were claimed but never credited (crash between the two steps). */
export async function recoverVouchers(olderThanMs = 120_000, limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stuck: any[] = await RechargeCardModel.find({
    used: true,
    claimState: "CLAIMED",
    usedBy: { $exists: true },
    creditedAt: { $exists: false },
    usedAt: { $lte: cutoff },
    redeemTxId: { $exists: false }, // on chain redemptions are settled by the payout operation instead
  }).limit(limit);
  let fixed = 0;
  for (const card of stuck) {
    try {
      const user = await UserModel.findOne({ phone: card.usedBy });
      if (!user) continue;
      await ledger.credit(String(user._id), kasToSompi(card.amount), `voucher:${card.code}`);
      await RechargeCardModel.updateOne({ _id: card._id }, { $set: { creditedAt: new Date() } });
      fixed++;
    } catch (err: any) {
      log.error("voucher recovery failed", { code: card.code, error: err?.message });
    }
  }
  return fixed;
}


/**
 * WhatsApp redemption: the operator pays the user on chain. The voucher is claimed atomically, the
 * payout is a logged operation keyed by the voucher code (so it can only ever happen once), and the
 * claim is released only if the payout is PROVEN not to have left. An unknown outcome is never rolled back.
 */
async function runChainRedeem(card: any, user: any): Promise<Operation> {
  const sompi = kasToSompi(card.amount);
  const op = await engine.execute(`redeem:${card.code}:${new Date(card.usedAt).getTime()}`, "PAYOUT", {
    fromWallet: "operator",
    fromAddress: process.env.OPERATOR_WALLET_ADDRESS || "",
    toAddress: user.walletAddress || user.wallet,
    amountSompi: sompi.toString(),
    next: { CONFIRMED: { kind: "CREDIT", key: `voucher:${card.code}`, userId: String(user._id), sompi: sompi.toString() } },
  });
  if (op.state === "CONFIRMED") {
    await RechargeCardModel.updateOne({ _id: card._id }, { $set: { redeemTxId: op.txids[op.txids.length - 1], creditedAt: new Date() } });
  } else if (op.state === "FAILED") {
    await RechargeCardModel.updateOne({ _id: card._id, redeemTxId: { $exists: false } }, { $set: { used: false }, $unset: { usedBy: "", usedAt: "", claimState: "" } });
  }
  return op;
}

export async function redeemOnChain(code: string, user: any): Promise<{ status: "INVALID" | "OK" | "PENDING" | "FAILED"; op?: Operation; amount?: number; message?: string }> {
  const card: any = await RechargeCardModel.findOneAndUpdate(
    { code, used: false },
    { $set: { used: true, usedBy: user.phone, usedAt: new Date(), claimState: "PAYOUT" } },
    { new: true }
  );
  if (!card) return { status: "INVALID" };
  const op = await runChainRedeem(card, user);
  if (op.state === "CONFIRMED") return { status: "OK", op, amount: card.amount };
  if (op.state === "FAILED") return { status: "FAILED", op, message: op.lastError };
  return { status: "PENDING", op, amount: card.amount };
}

/** Finishes chain redemptions that were claimed but interrupted (crash, restart, unknown outcome). */
export async function recoverChainRedemptions(olderThanMs = 120_000, limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const cards: any[] = await RechargeCardModel.find({ used: true, claimState: "PAYOUT", redeemTxId: { $exists: false }, usedAt: { $lte: cutoff } }).limit(limit);
  let n = 0;
  for (const card of cards) {
    try {
      const user = await UserModel.findOne({ phone: card.usedBy });
      if (!user) continue;
      await runChainRedeem(card, user);
      n++;
    } catch (err: any) {
      log.error("chain redemption recovery failed", { code: card.code, error: err?.message });
    }
  }
  return n;
}


// ---------------- creating a voucher ----------------

/**
 * Creating a voucher: the card is stored first but LOCKED (used:true, claimState FUNDING), the
 * user's KAS moves to the operator wallet as a logged payout, and only a confirmed payout unlocks
 * the card. A failed payout deletes the card and restores the balance. Idempotent per message.
 */
async function finalizeFunding(card: any): Promise<{ status: "OK" | "PENDING" | "FAILED"; code: string; message?: string }> {
  const user: any = await UserModel.findOne({ phone: card.purchasedByPhone });
  if (!user) return { status: "PENDING", code: card.code };
  const sompi = kasToSompi(card.amount);
  const op = await engine.execute(card.transactionRef, "PAYOUT", {
    fromWallet: `user:${user._id}`,
    fromAddress: user.walletAddress || user.wallet,
    toAddress: (process.env.OPERATOR_WALLET_ADDRESS || "").trim(),
    amountSompi: sompi.toString(),
    refundUserId: String(user._id),
    refundSompi: sompi.toString(),
  });
  if (op.state === "CONFIRMED") {
    await RechargeCardModel.updateOne(
      { _id: card._id, claimState: "FUNDING" },
      { $set: { used: false, fundingTxId: op.txids[op.txids.length - 1] }, $unset: { claimState: "" } }
    );
    return { status: "OK", code: card.code };
  }
  if (op.state === "FAILED") {
    await RechargeCardModel.deleteOne({ _id: card._id, claimState: "FUNDING" });
    return { status: "FAILED", code: card.code, message: op.lastError };
  }
  return { status: "PENDING", code: card.code };
}

export async function createVoucher(user: any, amountKas: number | string): Promise<{ status: "OK" | "PENDING" | "FAILED" | "INSUFFICIENT"; code?: string; amount?: number; message?: string }> {
  const sompi = kasToSompi(amountKas);
  const operator = (process.env.OPERATOR_WALLET_ADDRESS || "").trim();
  if (!operator) return { status: "FAILED", message: "Vouchers are temporarily unavailable." };

  const key = `vfund:${user._id}:${currentMessageId()}`;
  const debit = await ledger.debit(String(user._id), sompi, `debit:${key}`);
  if (debit === "INSUFFICIENT") return { status: "INSUFFICIENT" };

  const card: any = await RechargeCardModel.findOneAndUpdate(
    { transactionRef: key },
    {
      $setOnInsert: {
        code: generateVoucherCode(),
        amount: Number(sompi) / 100000000,
        vaultAddress: operator,
        purchasedByPhone: user.phone,
        transactionRef: key,
        used: true, // locked until funding is confirmed
        claimState: "FUNDING",
      },
    },
    { upsert: true, new: true }
  );
  const result = await finalizeFunding(card);
  return { ...result, amount: card.amount };
}

/** Completes voucher funding that was interrupted. */
export async function recoverVoucherFunding(olderThanMs = 120_000, limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const cards: any[] = await RechargeCardModel.find({ claimState: "FUNDING", createdAt: { $lte: cutoff } }).limit(limit);
  let n = 0;
  for (const card of cards) {
    try {
      await finalizeFunding(card);
      n++;
    } catch (err: any) {
      log.error("voucher funding recovery failed", { code: card.code, error: err?.message });
    }
  }
  return n;
}
