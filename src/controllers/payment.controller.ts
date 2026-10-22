// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { RechargeCardModel, IRechargeCard } from '../models/RechargeCard';
import { nairaToKAS } from '../utils/price';
import { verifyPaystackSignature } from '../utils/webhookSignature';


const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const BOT_PHONE = process.env.WHATSAPP_BOT_NUMBER || '2348000000000'; // E.164 format without '+'


// 🛡️ FIXED: Generates 8 random bytes (16 hex chars) and slices into 4 groups of 4
function generateVoucherCode(): string {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KASP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
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
   *
   * Order of operations matters:
   *  1. Verify the signature over the exact raw request bytes. Reject with 401 if it fails.
   *  2. Process the event (create the voucher exactly once).
   *  3. Only then acknowledge with 200. If processing fails we answer 500 so Paystack retries,
   *     and the unique transactionRef index makes a retry safe.
   */
  handlePaystackWebhook: async (req: Request, res: Response) => {
    const rawBody: Buffer | undefined = (req as any).rawBody;
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    if (!verifyPaystackSignature(rawBody, signature, PAYSTACK_SECRET_KEY)) {
      console.warn('[Paystack Webhook] Invalid or missing signature. Request rejected.');
      return res.sendStatus(401);
    }

    try {
      const event = req.body;

      // Other event types are acknowledged and ignored.
      if (event?.event !== 'charge.success') {
        return res.sendStatus(200);
      }

      const { amount, reference, metadata, currency } = event.data || {};

      if (!reference || typeof amount !== 'number' || !(amount > 0)) {
        console.warn('[Paystack Webhook] charge.success without a usable reference or amount. Ignored.');
        return res.sendStatus(200);
      }

      if (currency && currency !== 'NGN') {
        console.warn(`[Paystack Webhook] Ignoring non NGN payment (${currency}) for ${reference}.`);
        return res.sendStatus(200);
      }

      const amountNaira = amount / 100; // Convert back from Kobo to Naira
      const userPhone = metadata?.user_phone || 'Unknown';

      const existingVoucher = await RechargeCardModel.findOne({ transactionRef: reference });
      if (existingVoucher) {
        console.log(`[Paystack Webhook] Transaction ${reference} already processed.`);
        return res.sendStatus(200);
      }

      const kasAmount = await nairaToKAS(amountNaira);
      const voucherCode = generateVoucherCode();

      try {
        const newVoucher = (await RechargeCardModel.create({
          code: voucherCode,
          amount: kasAmount,
          amountNaira: amountNaira,
          transactionRef: reference,
          purchasedByPhone: userPhone,
          used: false,
          createdAt: new Date(),
        })) as unknown as IRechargeCard;

        console.log(`[Paystack Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS | Phone: ${userPhone}`);
      } catch (createError: any) {
        // Duplicate transactionRef: another delivery of the same event won the race. Safe to acknowledge.
        if (createError?.code === 11000 && createError?.keyPattern?.transactionRef) {
          console.log(`[Paystack Webhook] Transaction ${reference} was created by a concurrent delivery.`);
          return res.sendStatus(200);
        }
        throw createError;
      }

      return res.sendStatus(200);
    } catch (error: any) {
      console.error('[Paystack Webhook Processing Error]:', error);
      return res.sendStatus(500);
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


