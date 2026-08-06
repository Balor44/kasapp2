import { Request, Response } from 'express';
// @ts-ignore - Module lacks official ambient types
import Flutterwave from 'flutterwave-node-v3';
import crypto from 'crypto';
import { RechargeCardModel, IRechargeCard } from '../models/RechargeCard';
import { nairaToKAS } from '../utils/price';


const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY || '',
  process.env.FLW_SECRET_KEY || ''
);


const BOT_PHONE = process.env.WHATSAPP_BOT_NUMBER || '2348000000000'; // E.164 format without '+'


// Helper to generate voucher code format: KASP-XXXX-XXXX
function generateVoucherCode(): string {
  const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `KASP-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}


/**
 * Helper to generate official WhatsApp wa.me deep link with pre-filled message
 */
export function buildWhatsAppRedeemUrl(voucherCode: string): string {
  const text = encodeURIComponent(`redeem ${voucherCode}`);
  return `https://wa.me/${BOT_PHONE}?text=${text}`;
}


/**
 * 1. Initialize Flutterwave Payment Link
 */
export const initializeVoucherPurchase = async (req: Request, res: Response) => {
  try {
    const { email, phone, amountNaira, currency = 'NGN' } = req.body;


    if (!email || !phone || !amountNaira || amountNaira < 100) {
      return res.status(400).json({
        error: 'Valid email, phone, and minimum amount of 100 required.'
      });
    }


    const tx_ref = `KASAPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;


    const payload = {
      tx_ref,
      amount: amountNaira,
      currency, // NGN, KES, GHS, etc.
      redirect_url: req.body.redirect_url || `${req.headers.origin || 'https://kasapp.app'}/payment-success`,
      customer: {
        email,
        phonenumber: phone,
        name: `User ${phone}`,
      },
      customizations: {
        title: 'Kasapp Voucher Purchase',
        description: `Purchase Kaspa voucher worth ${currency} ${amountNaira}`,
      },
      meta: {
        user_phone: phone,
        amount_naira: amountNaira,
      },
    };


    const response = await flw.Payment.generate(payload);


    if (response.status === 'success') {
      return res.status(200).json({
        status: 'success',
        payment_url: response.data.link,
        tx_ref,
      });
    }


    return res.status(400).json({ error: 'Failed to generate payment link' });
  } catch (error: any) {
    console.error('[Payment Init Error]:', error?.message || error);
    return res.status(500).json({ error: 'Internal payment initialization error' });
  }
};


/**
 * 2. Automated Webhook Listener
 */
export const handleFlutterwaveWebhook = async (req: Request, res: Response) => {
  try {
    // Verify Webhook Signature
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers['verif-hash'];


    if (!signature || signature !== secretHash) {
      return res.status(401).send('Unauthorized webhook signature.');
    }


    const payload = req.body;


    // Listen for completed charges
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const { amount, customer, meta, tx_ref } = payload.data;
      const userPhone = meta?.user_phone || customer?.phonenumber;


      // Prevent duplicate processing
      const existingVoucher = await RechargeCardModel.findOne({ transactionRef: tx_ref });
      if (existingVoucher) {
        const waUrl = buildWhatsAppRedeemUrl(existingVoucher.code);
        return res.status(200).json({ 
          status: 'already_processed', 
          code: existingVoucher.code, 
          whatsapp_url: waUrl 
        });
      }


      // Convert Naira amount to KAS value
      const kasAmount = await nairaToKAS(amount);
      const voucherCode = generateVoucherCode();


      // Create voucher entry in Database with explicit interface casting
      const newVoucher: IRechargeCard = await RechargeCardModel.create({
        code: voucherCode,
        amount: kasAmount, // KAS value saved to card
        amountNaira: amount,
        transactionRef: tx_ref,
        purchasedByPhone: userPhone,
        used: false,
        createdAt: new Date(),
      });


      const waUrl = buildWhatsAppRedeemUrl(newVoucher.code);


      console.log(`[Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS (₦${amount}) | Phone: ${userPhone}`);


      return res.status(200).json({
        status: 'success',
        code: newVoucher.code,
        amountKas: kasAmount,
        whatsapp_url: waUrl,
      });
    }


    return res.status(200).json({ status: 'ignored_event' });
  } catch (error: any) {
    console.error('[Flutterwave Webhook Error]:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
};