// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { RechargeCardModel, IRechargeCard } from '../models/RechargeCard';
import { nairaToKAS } from '../utils/price';


const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const BOT_PHONE = process.env.WHATSAPP_BOT_NUMBER || '2348000000000'; // E.164 format without '+'


// Helper to generate voucher code format: KASP-XXXX-XXXX-XXXX
function generateVoucherCode(): string {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KASP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}


/**
 * Helper to generate official WhatsApp wa.me deep link with pre-filled message
 */
export function buildWhatsAppRedeemUrl(voucherCode: string): string {
  const text = encodeURIComponent(`redeem ${voucherCode}`);
  return `https://wa.me/${BOT_PHONE}?text=${text}`;
}


export const PaymentController = {
  /**
   * 1. Initialize Paystack Payment Link
   */
  initializeVoucherPurchase: async (req: Request, res: Response) => {
    try {
      const { email, phone, amountNaira, currency = 'NGN' } = req.body;


      if (!email || !phone || !amountNaira || amountNaira < 3000) {
        return res.status(400).json({
          error: 'Valid email, phone, and minimum amount of ₦3,000 required.'
        });
      }


      const tx_ref = `KASAPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const redirect_url = req.body.redirect_url || `${req.headers.origin || 'https://mykasapp.com'}/`;


      const paystackPayload = {
        email,
        amount: amountNaira * 100, // Paystack expects amounts in Kobo
        reference: tx_ref,
        callback_url: redirect_url,
        metadata: {
          user_phone: phone,
          amount_naira: amountNaira
        }
      };


      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        paystackPayload,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status) {
        return res.status(200).json({
          status: 'success',
          payment_url: response.data.data.authorization_url,
          tx_ref,
        });
      }


      return res.status(400).json({ error: 'Failed to generate Paystack payment link' });


    } catch (error: any) {
      console.error('[Payment Init Error]:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Internal payment initialization error' });
    }
  },


  /**
   * 2. Automated Webhook Listener: Paystack
   * Route this to POST /api/webhooks/paystack
   */
  handlePaystackWebhook: async (req: Request, res: Response) => {
    // Instantly return 200 OK so Paystack doesn't timeout/retry
    res.sendStatus(200);


    try {
      // Paystack signature verification (HMAC SHA512)
      const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                         .update(JSON.stringify(req.body))
                         .digest('hex');
                         
      if (hash !== req.headers['x-paystack-signature']) {
        console.warn('[Paystack Webhook] Invalid signature detected.');
        return;
      }


      const event = req.body;


      if (event.event === 'charge.success') {
        const { amount, reference, metadata } = event.data;
        const amountNaira = amount / 100; // Convert back from Kobo to Naira
        const userPhone = metadata?.user_phone || 'Unknown';


        const existingVoucher = await RechargeCardModel.findOne({ transactionRef: reference });
        if (existingVoucher) {
          console.log(`[Paystack Webhook] Transaction ${reference} already processed.`);
          return;
        }


        const kasAmount = await nairaToKAS(amountNaira);
        const voucherCode = generateVoucherCode();


        const newVoucher: IRechargeCard = await RechargeCardModel.create({
          code: voucherCode,
          amount: kasAmount,
          amountNaira: amountNaira,
          transactionRef: reference,
          purchasedByPhone: userPhone,
          used: false,
          createdAt: new Date(),
        }) as unknown as IRechargeCard;


        console.log(`[Paystack Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS | Phone: ${userPhone}`);
      }
    } catch (error: any) {
      console.error('[Paystack Webhook Processing Error]:', error);
    }
  },


  /**
   * 3. Fetch Voucher for the Frontend
   */
  verifyVoucherQuery: async (req: Request, res: Response) => {
    try {
      const { tx_ref } = req.query;


      if (!tx_ref) {
        return res.status(400).json({ error: 'tx_ref is required' });
      }


      const cleanTxRef = String(tx_ref);
      const voucher = await RechargeCardModel.findOne({ transactionRef: cleanTxRef });


      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found or payment pending.' });
      }


      const waUrl = buildWhatsAppRedeemUrl(voucher.code);


      return res.status(200).json({
        status: 'success',
        code: voucher.code,
        amountKas: voucher.amount,
        amountNaira: voucher.amountNaira,
        whatsapp_url: waUrl,
      });
    } catch (error: any) {
      console.error('[Verify Voucher Error]:', error);
      return res.status(500).json({ error: 'Failed to verify voucher' });
    }
  },
};
