import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { nairaToKAS } from '../utils/price';
import { normalizePhone } from '../utils/phone';
import { kasToSompi } from '../utils/sompi';
import { formatBalance } from '../utils/balance';
import { ledger } from '../services/ledger.mongo';
import { engine } from '../services/ops';

type Kind = 'airtime' | 'electricity' | 'water' | 'cable';

/**
 * Flow: debit the user once (ledger ref), run the bill as an idempotent operation, and refund only
 * if the provider PROVES failure. A timeout leaves the operation open for the reconciler.
 * The Idempotency-Key header makes a retried request return the same operation, never a second bill.
 */
async function handleBillPayment(req: Request, res: Response, kind: Kind, targetField: string): Promise<void> {
  try {
    const { phone: rawPhone, amount, provider } = req.body;
    const phone = normalizePhone(rawPhone);
    const target = req.body[targetField];
    const idem = String(req.header('Idempotency-Key') || '').trim();

    if (!phone || !target || !amount || !provider) {
      res.status(400).json({ error: 'phone, ' + targetField + ', amount, and provider are required' });
      return;
    }
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(idem)) {
      res.status(400).json({ error: 'Idempotency-Key header (8 to 80 letters, digits, - or _) is required' });
      return;
    }
    const naira = Number(amount);
    if (!Number.isFinite(naira) || naira <= 0) { res.status(400).json({ error: 'Invalid amount' }); return; }

    const user = await UserModel.findOne({ phone });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const opKey = `bill:${user._id}:${idem}`;
    const requiredSompi = kasToSompi(await nairaToKAS(naira));

    const debit = await ledger.debit(String(user._id), requiredSompi, `debit:${opKey}`);
    if (debit === 'INSUFFICIENT') {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    const op = await engine.execute(opKey, 'BILL', {
      provider: 'FLUTTERWAVE', kind, target, network: provider, amountNaira: naira,
      refundUserId: String(user._id), refundSompi: requiredSompi.toString(),
    });

    const fresh = await UserModel.findById(user._id);
    const newBalance = formatBalance(fresh || user) + ' KAS';

    if (op.state === 'DELIVERED') {
      res.json({ status: 'success', reference: op.providerRef, newBalance });
    } else if (op.state === 'FAILED') {
      res.status(400).json({ error: 'The provider could not complete this payment. Your balance was restored.', newBalance });
    } else {
      // Still being confirmed with the provider. Not a failure and not refunded yet.
      res.status(202).json({ status: 'pending', reference: op.providerRef, message: 'Payment is being confirmed. You will not be charged twice.' });
    }
  } catch (error: any) {
    console.error(error?.message);
    res.status(500).json({ error: 'Server error' });
  }
}

export const buyAirtime = (req: Request, res: Response) => handleBillPayment(req, res, 'airtime', 'targetPhone');
export const payElectricity = (req: Request, res: Response) => handleBillPayment(req, res, 'electricity', 'meterNumber');
export const payWater = (req: Request, res: Response) => handleBillPayment(req, res, 'water', 'accountNumber');
export const payCable = (req: Request, res: Response) => handleBillPayment(req, res, 'cable', 'smartcardNumber');
