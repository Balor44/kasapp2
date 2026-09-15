import { Request, Response } from 'express';
import { RechargeCardModel } from '../models/RechargeCard';
import { VaultService } from '../wallet/vault.service';
import { normalizeVoucherCode } from '../utils/voucherCode';
import crypto from 'crypto'; // 🛡️ Added crypto import


export const redeemMerchantVoucher = async (req: Request, res: Response) => {
  try {
    const { code, merchantAddress } = req.body;
    
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.MERCHANT_API_KEY || '';


    // 🛡️ TIMING-SAFE API KEY CHECK
    if (!apiKey || !expectedKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }


    const apiKeyBuffer = Buffer.from(apiKey);
    const expectedKeyBuffer = Buffer.from(expectedKey);


    if (apiKeyBuffer.length !== expectedKeyBuffer.length || !crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer)) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }


    if (!code || !merchantAddress) {
      return res.status(400).json({ success: false, error: 'Missing code or merchantAddress in payload' });
    }


    const cleanCode = normalizeVoucherCode(code);
    console.log(`[API Debug] Raw code received from payload:`, code);
    console.log(`[API Debug] Normalized code searching DB:`, cleanCode);


    // 🛡️ ATOMIC VOUCHER CLAIM FIX
    const voucher = await RechargeCardModel.findOneAndUpdate(
      { code: cleanCode, used: false },
      { $set: { used: true, claimedAt: new Date() } },
      { new: false } // Returns the old document so we still have the amount and vaultAddress
    );
   
    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Invalid or already redeemed voucher code' });
    }


    if (!voucher.vaultAddress) {
      // Rollback the lock if data is corrupt
      await RechargeCardModel.updateOne({ _id: voucher._id }, { $set: { used: false, claimedAt: null } });
      return res.status(500).json({ success: false, error: 'Vault address missing on this voucher' });
    }


    const pinProvided = req.body.pin;
    const result = await VaultService.redeemVoucherEscrow(
      merchantAddress,
      voucher.vaultAddress,
      cleanCode,
      voucher.amount,
      pinProvided
    );


    if (!result.success) {
      // 🛡️ ROLLBACK LOCK IF BLOCKCHAIN FAILS
      await RechargeCardModel.updateOne({ _id: voucher._id }, { $set: { used: false, claimedAt: null } });
      return res.status(500).json({ success: false, error: `On-chain execution failed: ${result.error}` });
    }


    return res.status(200).json({
      success: true,
      message: 'Payment successfully processed',
      amount: voucher.amount,
      txId: result.txId
    });


  } catch (error: any) {
    console.error('[Merchant API] Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};


