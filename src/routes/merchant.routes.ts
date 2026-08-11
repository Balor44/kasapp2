import { Router } from 'express';
import { UserModel } from '../models/User';
import { KaspaService } from '../wallet/kaspa.service';
import { nairaToKAS } from '../utils/price'; // Assuming you have this from the price oracle
import crypto from 'crypto';


const router = Router();


// In-memory invoice store (For production, move this to a MongoDB InvoiceModel)
const pendingInvoices = new Map();


/**
 * @route POST /api/merchant/invoice
 * @desc Generates a Kaspa payment request for a campus vendor
 */
router.post('/invoice', async (req: any, res: any) => {
  try {
    const { merchantPhone, amountNaira, description } = req.body;


    if (!merchantPhone || !amountNaira) {
      return res.status(400).json({ error: 'merchantPhone and amountNaira are required' });
    }


    // 1. Find the merchant's wallet
    const merchant = await UserModel.findOne({ phone: merchantPhone });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant wallet not found. Register via WhatsApp first.' });
    }


    // 2. Convert Fiat to KAS using live oracle
    const amountKas = await nairaToKAS(amountNaira);
    
    // 3. Generate unique invoice ID
    const invoiceId = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;


    // 4. Store the pending invoice
    pendingInvoices.set(invoiceId, {
      merchantAddress: merchant.walletAddress,
      amountKas,
      status: 'pending'
    });


    // 5. Return the standard Kaspa URI (BIP-21 format) for QR code generation on the frontend
    const paymentUri = `kaspa:${merchant.walletAddress}?amount=${amountKas}`;


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
    const invoice = pendingInvoices.get(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }


    if (invoice.status === 'paid') {
      return res.json({ status: 'paid', amountKas: invoice.amountKas });
    }


    // Check the live on-chain balance of the merchant
    // (In a full production environment, you would scan for the specific UTXO rather than total balance)
    const currentBalance = await KaspaService.getBalance(invoice.merchantAddress);


    // Simple verification: If balance >= invoice amount, mark paid
    // Note: For multi-invoice merchants, UTXO tracking is recommended
    if (currentBalance >= invoice.amountKas) {
      invoice.status = 'paid';
      pendingInvoices.set(req.params.id, invoice);
      return res.json({ status: 'paid', amountKas: invoice.amountKas });
    }


    return res.json({ status: 'pending', amountKas: invoice.amountKas });
  } catch (error: any) {
    console.error('[Merchant API] Status Check Error:', error);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});


export default router;