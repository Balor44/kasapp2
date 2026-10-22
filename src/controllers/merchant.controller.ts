import { Request, Response } from 'express';
import { resolveMerchant } from '../utils/merchantKeys';
import { RechargeCardModel } from '../models/RechargeCard';
import { checkRedemptionPolicy } from '../wallet/vault.service';
import { normalizeVoucherCode } from '../utils/voucherCode';
import { kasToSompi } from '../utils/sompi';
import { log } from '../utils/logger';
import { engine } from '../services/ops';

function respond(res: Response, state: string, extra: Record<string, unknown>) {
  if (state === 'CONFIRMED') return res.status(200).json({ success: true, status: 'PAID', message: 'Payment successfully processed', ...extra });
  if (state === 'FAILED') return res.status(502).json({ success: false, status: 'FAILED', retryable: true, error: 'The payment could not be sent. The voucher is still valid, retry.', ...extra });
  if (state === 'NEEDS_REVIEW') return res.status(202).json({ success: true, status: 'REVIEW', message: 'Payment is under review. Do not retry.', ...extra });
  return res.status(202).json({ success: true, status: 'PENDING', message: 'Payment is being confirmed. Retrying this request is safe and will never pay twice.', ...extra });
}

/**
 * Idempotent per voucher: the payout operation is keyed by the voucher code, so any number of
 * retries (same merchant, same address) returns the same result and never pays twice. A failed
 * payout releases the voucher only when the failure is proven.
 */
export const redeemMerchantVoucher = async (req: Request, res: Response) => {
  try {
    const merchant = resolveMerchant(req.headers['x-api-key'] as string | undefined);
    if (!merchant) return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });

    const { code, merchantAddress } = req.body;
    if (!code || !merchantAddress) {
      return res.status(400).json({ success: false, error: 'Missing code or merchantAddress in payload' });
    }
    const cleanCode = normalizeVoucherCode(code);
    const address = String(merchantAddress).trim();

    // Repeat call for a voucher this merchant already claimed: report the existing operation.
    const existing: any = await RechargeCardModel.findOne({ code: cleanCode, claimState: 'MERCHANT' });
    if (existing) {
      if (existing.merchantName !== merchant || existing.merchantAddress !== address) {
        return res.status(404).json({ success: false, error: 'Invalid or already redeemed voucher code' });
      }
      const op = await engine.execute(`mredeem:${cleanCode}:${new Date(existing.usedAt).getTime()}`, 'PAYOUT', {
        fromWallet: 'operator', fromAddress: process.env.OPERATOR_WALLET_ADDRESS || '', toAddress: address,
        amountSompi: kasToSompi(existing.amount).toString(),
      });
      if (op.state === 'FAILED') {
        await RechargeCardModel.updateOne({ _id: existing._id, redeemTxId: { $exists: false } }, { $set: { used: false }, $unset: { usedBy: '', usedAt: '', claimState: '', merchantAddress: '', merchantName: '' } });
      } else if (op.state === 'CONFIRMED') {
        await RechargeCardModel.updateOne({ _id: existing._id }, { $set: { redeemTxId: op.txids[op.txids.length - 1] } });
      }
      return respond(res, op.state, { amount: existing.amount, txId: op.txids[op.txids.length - 1] });
    }

    const voucher: any = await RechargeCardModel.findOne({ code: cleanCode, used: false });
    if (!voucher) return res.status(404).json({ success: false, error: 'Invalid or already redeemed voucher code' });
    if (!voucher.vaultAddress) return res.status(500).json({ success: false, error: 'Vault address missing on this voucher' });

    // Policy runs BEFORE the claim, so a rejected request never touches the voucher.
    const policyError = checkRedemptionPolicy(address, voucher.amount, req.body.pin);
    if (policyError) return res.status(400).json({ success: false, error: policyError });

    // Atomic claim: only one request can win, and it records who and where.
    const claimed: any = await RechargeCardModel.findOneAndUpdate(
      { code: cleanCode, used: false },
      { $set: { used: true, usedBy: `merchant:${merchant}`, usedAt: new Date(), claimState: 'MERCHANT', merchantName: merchant, merchantAddress: address } },
      { new: true }
    );
    if (!claimed) return res.status(404).json({ success: false, error: 'Invalid or already redeemed voucher code' });

    const op = await engine.execute(`mredeem:${cleanCode}:${new Date(claimed.usedAt).getTime()}`, 'PAYOUT', {
      fromWallet: 'operator', fromAddress: process.env.OPERATOR_WALLET_ADDRESS || '', toAddress: address,
      amountSompi: kasToSompi(claimed.amount).toString(),
    });
    log.info('merchant redeem', { merchant, state: op.state, op: op.key });

    if (op.state === 'FAILED') {
      await RechargeCardModel.updateOne({ _id: claimed._id, redeemTxId: { $exists: false } }, { $set: { used: false }, $unset: { usedBy: '', usedAt: '', claimState: '', merchantAddress: '', merchantName: '' } });
    } else if (op.state === 'CONFIRMED') {
      await RechargeCardModel.updateOne({ _id: claimed._id }, { $set: { redeemTxId: op.txids[op.txids.length - 1] } });
    }
    return respond(res, op.state, { amount: claimed.amount, txId: op.txids[op.txids.length - 1] });
  } catch (error: any) {
    console.error('[Merchant API] Error:', error?.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
