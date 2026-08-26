import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { RechargeCardModel, IRechargeCard } from '../models/RechargeCard';
import { nairaToKAS } from '../utils/price';


const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const BOT_PHONE = process.env.WHATSAPP_BOT_NUMBER || '2348000000000'; // E.164 format without '+'


// Helper to generate voucher code format: KASP-XXXX-XXXX
function generateVoucherCode(): string {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KASP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(12, 16)}`;
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
   * 1. Initialize Payment Link (Routes to Paystack or Flutterwave)
   */
  initializeVoucherPurchase: async (req: Request, res: Response) => {
    try {
      const { email, phone, amountNaira, currency = 'NGN', gateway = 'flutterwave' } = req.body;


      // Minimum amount updated to 3000 to match new frontend rules
      if (!email || !phone || !amountNaira || amountNaira < 3000) {
        return res.status(400).json({
          error: 'Valid email, phone, and minimum amount of ₦3,000 required.'
        });
      }


      const tx_ref = `KASAPP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const redirect_url = req.body.redirect_url || `${req.headers.origin || 'https://mykasapp.com'}/payment-success`;
      
      // ---------------------------------------------------------
      // ROUTE A: PAYSTACK INTEGRATION
      // ---------------------------------------------------------
      if (gateway === 'paystack') {
        const paystackPayload = {
          email,
          amount: amountNaira * 100, // Paystack requires amounts in Kobo (multiply by 100)
          reference: tx_ref,
          callback_url: redirect_url,
          metadata: {
            user_phone: phone, // Pass custom meta so we can grab it in the webhook
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
        return res.status(400).json({ error: 'Failed to generate Paystack link' });
      }


      // ---------------------------------------------------------
      // ROUTE B: FLUTTERWAVE INTEGRATION
      // ---------------------------------------------------------
      if (gateway === 'flutterwave') {
        const flutterwavePayload = {
          tx_ref,
          amount: amountNaira,
          currency,
          redirect_url,
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


        const response = await axios.post(
          'https://api.flutterwave.com/v3/payments',
          flutterwavePayload,
          { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' } }
        );


        if (response.data.status === 'success') {
          return res.status(200).json({
            status: 'success',
            payment_url: response.data.data.link,
            tx_ref,
          });
        }
        return res.status(400).json({ error: 'Failed to generate Flutterwave link' });
      }


      return res.status(400).json({ error: 'Invalid payment gateway selected' });


    } catch (error: any) {
      console.error('[Payment Init Error]:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Internal payment initialization error' });
    }
  },


  /**
   * 2. Automated Webhook Listener: Flutterwave
   */
  handleFlutterwaveWebhook: async (req: Request, res: Response) => {
    try {
      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = req.headers['verif-hash'];


      if (!signature || signature !== secretHash) {
        return res.status(401).send('Unauthorized webhook signature.');
      }


      const payload = req.body;


      if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
        const { amount, customer, meta, tx_ref } = payload.data;
        const userPhone = meta?.user_phone || customer?.phonenumber;


        const existingVoucher = await RechargeCardModel.findOne({ transactionRef: tx_ref });
        if (existingVoucher) {
          return res.status(200).json({ status: 'already_processed' });
        }


        const kasAmount = await nairaToKAS(amount);
        const voucherCode = generateVoucherCode();


        const newVoucher: IRechargeCard = await RechargeCardModel.create({
          code: voucherCode,
          amount: kasAmount,
          amountNaira: amount,
          transactionRef: tx_ref,
          purchasedByPhone: userPhone,
          used: false,
          createdAt: new Date(),
        }) as unknown as IRechargeCard;


        console.log(`[Flutterwave Webhook: Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS | Phone: ${userPhone}`);
        return res.status(200).json({ status: 'success' });
      }


      return res.status(200).json({ status: 'ignored_event' });
    } catch (error: any) {
      console.error('[Flutterwave Webhook Error]:', error);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  },


  /**
   * 3. NEW: Automated Webhook Listener: Paystack
   * Route this to POST /api/webhooks/paystack in your Express router
   */
  handlePaystackWebhook: async (req: Request, res: Response) => {
    try {
      // Paystack signature verification (HMAC SHA512)
      const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                         .update(JSON.stringify(req.body))
                         .digest('hex');
                         
      if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).send('Unauthorized Paystack signature.');
      }


      const event = req.body;


      if (event.event === 'charge.success') {
        const { amount, reference, metadata } = event.data;
        const amountNaira = amount / 100; // Convert back from Kobo
        const userPhone = metadata?.user_phone || 'Unknown';


        const existingVoucher = await RechargeCardModel.findOne({ transactionRef: reference });
        if (existingVoucher) {
          return res.status(200).json({ status: 'already_processed' });
        }


        const kasAmount = await nairaToKAS(amountNaira);
        const voucherCode = generateVoucherCode();


        const newVoucher: IRechargeCard = await RechargeCardModel.create({
          code: voucherCode,
          amount: kasAmount,
          amountNaira: amountNaira,
          transactionRef: reference, // Paystack calls it reference, but it maps to our tx_ref
          purchasedByPhone: userPhone,
          used: false,
          createdAt: new Date(),
        }) as unknown as IRechargeCard;


        console.log(`[Paystack Webhook: Voucher Created] Code: ${newVoucher.code} | Value: ${kasAmount} KAS | Phone: ${userPhone}`);
        return res.status(200).json({ status: 'success' });
      }


      return res.status(200).json({ status: 'ignored_event' });
    } catch (error: any) {
      console.error('[Paystack Webhook Error]:', error);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  },


  /**
   * 4. Fetch Voucher for the Frontend
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