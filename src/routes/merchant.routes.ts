import { Router } from 'express';
import { UserModel } from '../models/User';
import { KaspaService } from '../wallet/kaspa.service';
import { nairaToKAS } from '../utils/price';
import { InvoiceModel } from '../models/Invoice';
import { requireAdminKey } from '../middleware/auth.middleware';
import crypto from 'crypto';


const router = Router();


/**
 * @route POST /api/merchant/invoice
 * @desc Generates a Kaspa payment request for a campus vendor
 */
// 🛡️ FIX: Added requireAdminKey to prevent invoice spam
router.post('/invoice', requireAdminKey, async (req: any, res: any) => {
  try {
    const { merchantPhone, amountNaira, description } = req.body;


    if (!merchantPhone || !amountNaira) {
      return res.status(400).json({ error: 'merchantPhone and amountNaira are required' });
    }


    const merchant = await UserModel.findOne({ phone: merchantPhone });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant wallet not found. Register via WhatsApp first.' });
    }


    const amountKas = await nairaToKAS(amountNaira);
    const invoiceId = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // 🛡️ FIX: Record their starting balance so we know if they ACTUALLY get paid
    const startingBalance = await KaspaService.getBalance(merchant.walletAddress || '');


    // 🛡️ FIX: Save to MongoDB, not an in-memory Map
    await InvoiceModel.create({
      invoiceId,
      merchantPhone,
      merchantAddress: merchant.walletAddress,
      amountKas,
      startingBalance,
      status: 'pending'
    });


    // 🛡️ FIX: Prevent kaspa:kaspa: double prefix for QR codes
    const addressStr = merchant.walletAddress || '';
    const paymentUri = addressStr.startsWith('kaspa:') 
      ? `${addressStr}?amount=${amountKas}`
      : `kaspa:${addressStr}?amount=${amountKas}`;


    return res.json({
      success: true,
      invoiceId,
      description: description || 'Campus Hub Purchase',
      fiatAmount: `₦${amountNaira}`,
      amountKas,
      paymentUri,
      merchantAddress: merchant.walletAddress
    });
  } catch (error: any) {
    console.error('[Merchant API] Invoice Creation Error:', error);
    return res.status(500).json({ error: 'Failed to generate invoice' });
  }
});


/**
 * @route GET /api/merchant/invoice/:id/status
 * @desc Checks if the invoice has been paid on-chain
 */
router.get('/invoice/:id/status', async (req: any, res: any) => {
  try {
    // 🛡️ FIX: Fetch from MongoDB
    const invoice = await InvoiceModel.findOne({ invoiceId: req.params.id });
   
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }


    if (invoice.status === 'paid') {
      return res.json({ status: 'paid', amountKas: invoice.amountKas });
    }


    const currentBalance = await KaspaService.getBalance(invoice.merchantAddress);


    // 🛡️ FIX: Check if current balance is >= (startingBalance + invoiceAmount)
    // This proves new funds actually arrived!
    if (currentBalance >= (invoice.startingBalance + invoice.amountKas)) {
      invoice.status = 'paid';
      await invoice.save();
      return res.json({ status: 'paid', amountKas: invoice.amountKas });
    }


    return res.json({ status: 'pending', amountKas: invoice.amountKas });
  } catch (error: any) {
    console.error('[Merchant API] Status Check Error:', error);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});


export default router;


