import { Request, Response } from 'express';
import { RechargeCardModel } from '../models/RechargeCard';
import { VaultService } from '../wallet/vault.service';
import { normalizeVoucherCode } from '../utils/voucherCode';


export const redeemMerchantVoucher = async (req: Request, res: Response): Promise => {
  try {
    const { code, merchantAddress } = req.body;
    const apiKey = req.headers['x-api-key'];


    // 1. Basic Security: Ensure only authorized merchants can hit this endpoint
    if (apiKey !== process.env.MERCHANT_API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
    }


    if (!code || !merchantAddress) {
      return res.status(400).json({ success: false, error: 'Missing code or merchantAddress in payload' });
    }


    // 2. Normalize the code using our bulletproof utility
    const cleanCode = normalizeVoucherCode(code);


    // 3. Verify in the database
    const voucher = await RechargeCardModel.findOne({ code: cleanCode });
    
    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Invalid voucher code' });
    }
    if (voucher.used) {
      return res.status(400).json({ success: false, error: 'Voucher has already been redeemed' });
    }


    // 4. Execute the on-chain transition via Argent Covenant
    const result = await VaultService.redeemVoucherEscrow(
      merchantAddress,
      voucher.vaultAddress,
      cleanCode
    );


    if (!result.success) {
      return res.status(500).json({ success: false, error: `On-chain execution failed: ${result.error}` });
    }


    // 5. Update DB State
    voucher.used = true;
    // Optionally save the merchant address if you added a 'redeemedBy' field to your schema
    await voucher.save();


    // 6. Return the success receipt
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