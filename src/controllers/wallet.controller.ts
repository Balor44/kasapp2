import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { normalizePhone } from '../utils/phone';
import { formatBalance } from '../utils/balance';
import { kasToSompi } from '../utils/sompi';
import { provisionUser } from '../services/user.service';
import { ledger } from '../services/ledger.mongo';

export const createWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone: rawPhone } = req.body;
    const phone = normalizePhone(rawPhone);
    if (!phone) { res.status(400).json({ error: 'phone is required' }); return; }

    // The seed is encrypted before it is stored (see services/user.service.ts).
    const user = await provisionUser(phone);
    if (!user) { res.status(409).json({ error: 'Wallet already exists' }); return; }

    res.status(201).json({
      success: true,
      data: { phone: user.phone, wallet: user.wallet, balance: '0 KAS' },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getBalance = async (req: Request, res: Response): Promise<void> => {
  const phone = normalizePhone(req.params.phone as string);

  try {
    const user = await UserModel.findOne({ phone });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({ wallet: user.wallet, balance: formatBalance(user) + ' KAS' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Moves balance between two users on the ledger. Exactly once per Idempotency-Key header:
 * a retry with the same key never moves money twice. Both legs are atomic and a failed credit
 * is paid back to the sender.
 */
export const sendMoney = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, amount } = req.body;
    const key = String(req.header('Idempotency-Key') || '').trim();
    if (!from || !to || !amount) { res.status(400).json({ error: 'from, to, and amount are required' }); return; }
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) { res.status(400).json({ error: 'Idempotency-Key header (8 to 80 letters, digits, - or _) is required' }); return; }

    const sender = await UserModel.findOne({ phone: normalizePhone(from) });
    const receiver = await UserModel.findOne({ phone: normalizePhone(to) });
    if (!sender) { res.status(404).json({ error: 'Sender not found' }); return; }
    if (!receiver) { res.status(404).json({ error: 'Recipient not found' }); return; }
    if (String(sender._id) === String(receiver._id)) { res.status(400).json({ error: 'Cannot send to yourself' }); return; }

    let sompi: bigint;
    try { sompi = kasToSompi(amount); } catch { res.status(400).json({ error: 'Invalid amount' }); return; }

    const debit = await ledger.debit(String(sender._id), sompi, `xfer-out:${key}`);
    if (debit === 'INSUFFICIENT') { res.status(400).json({ error: 'Insufficient balance' }); return; }
    // DUPLICATE means this key already moved the debit: finish the credit leg, which is also idempotent.
    await ledger.credit(String(receiver._id), sompi, `xfer-in:${key}`);

    const fresh = await UserModel.findById(sender._id);
    res.json({ status: 'success', newBalance: formatBalance(fresh || sender) + ' KAS' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
