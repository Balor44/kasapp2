import { Request, Response } from 'express';
import { RechargeCardModel } from '../models/RechargeCard';
import { VaultService } from '../wallet/vault.service';
import { normalizeVoucherCode } from '../utils/voucherCode';


// Fix 1: Removed explicit Promise return type to let Express infer it
export const redeemMerchantVoucher = async (req: Request, res: Response) => {
  try {
    const { code, merchantAddress } = req.body;
    const apiKey = req.headers['x-api-key'];


    if (apiKey !== process.env.MERCHANT_API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }


    if (!code || !merchantAddress) {
      return res.status(400).json({ success: false, error: 'Missing code or merchantAddress in payload' });
    }


    const cleanCode = normalizeVoucherCode(code);
    console.log(`[API Debug] Raw code received from payload:`, code);
    console.log(`[API Debug] Normalized code searching DB:`, cleanCode);

    const voucher = await RechargeCardModel.findOne({ code: cleanCode });
    
    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Invalid voucher code' });
    }
    if (voucher.used) {
      return res.status(400).json({ success: false, error: 'Voucher has already been redeemed' });
    }


    // Fix 2: Guarantee vaultAddress is a string for the compiler
    if (!voucher.vaultAddress) {
      return res.status(500).json({ success: false, error: 'Vault address missing on this voucher' });
    }

    const pinProvided = req.body.pin;
    const result = await VaultService.redeemVoucherEscrow(
      merchantAddress,
      voucher.vaultAddress,
      cleanCode,
      voucher.amount,
      pinProvided // Pass this if the user provided one, otherwise undefined 
    );


    if (!result.success) {
      return res.status(500).json({ success: false, error: `On-chain execution failed: ${result.error}` });
    }


    voucher.used = true;
    await voucher.save();


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