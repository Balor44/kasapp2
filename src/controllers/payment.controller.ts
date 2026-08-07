import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { RechargeCardModel, IRechargeCard } from '../models/RechargeCard';
import { nairaToKAS } from '../utils/price';


const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
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


export const PaymentController = {
  /**
   * 1. Initialize Flutterwave Payment Link
   */
  initializeVoucherPurchase: async (req: Request, res: Response) => {
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
        currency, 
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


      // Using Axios for cleaner integration, matching your billpay.service.ts
      const response = await axios.post(
        'https://api.flutterwave.com/v3/payments',
        payload,
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
      );


      if (response.data.status === 'success') {
        return res.status(200).json({
          status: 'success',
          payment_url: response.data.data.link,
          tx_ref,
        });
      }


      return res.status(400).json({ error: 'Failed to generate payment link' });
    } catch (error: any) {
      console.error('[Payment Init Error]:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Internal payment initialization error' });
    }
  },


  /**
   * 2. Automated Webhook Listener (Handles the actual DB creation in the background)
   */
  handleFlutterwaveWebhook: async (req: Request, res: Response) => {
    try {
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
          return res.status(200).json({ status: 'already_processed' }); // Flw just needs a 200 OK
        }


        // Convert Naira amount to KAS value using the Live Oracle
        const kasAmount = await nairaToKAS(amount);
        const voucherCode = generateVoucherCode();


        // Create voucher entry in Database using your exact schema
        const newVoucher: IRechargeCard = await RechargeCardModel.create({
          code: voucherCode,
          amount: kasAmount, 
          amountNaira: amount,
          transactionRef: tx_ref,
          purchasedByPhone: userPhone,
          used: false,
          createdAt: new Date(),
        });


        console.log(`[Webhook: Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS | Phone: ${userPhone}`);


        // Acknowledge receipt to Flutterwave so they stop retrying the webhook
        return res.status(200).json({ status: 'success' });
      }


      return res.status(200).json({ status: 'ignored_event' });
    } catch (error: any) {
      console.error('[Flutterwave Webhook Error]:', error);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  },


  /**
   * 3. NEW: Fetch Voucher for the Frontend
   * The frontend calls this when the user is redirected back to /payment-success?tx_ref=XXXX
   */
verifyVoucherQuery: async (req: Request, res: Response) => {
    try {
      const { tx_ref } = req.query;


      if (!tx_ref) {
        return res.status(400).json({ error: 'tx_ref is required' });
      }


      // Explicitly cast tx_ref to a clean string to satisfy Mongoose and TS types
      const cleanTxRef = String(tx_ref);


      // Check if the webhook has finished creating the voucher
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