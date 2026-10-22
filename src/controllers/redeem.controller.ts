import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { normalizePhone } from '../utils/phone';
import { normalizeVoucherCode } from '../utils/voucherCode';
import { formatBalance } from '../utils/balance';
import { formatKas } from '../utils/sompi';
import { redeemToUser } from '../services/vouchers';

export const redeemCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = normalizeVoucherCode(req.body.code);

    if (!phone || !code || code.length !== 14) {
      res.status(400).json({ error: 'phone and code are required' });
      return;
    }

    const result = await redeemToUser(code, phone);
    if (result.status === 'NO_USER') { res.status(404).json({ error: 'User not found' }); return; }
    if (result.status === 'INVALID') { res.status(404).json({ error: 'Invalid or already used code' }); return; }

    const user = await UserModel.findOne({ phone });
    res.json({
      credited: formatKas(result.creditedSompi!) + ' KAS',
      newBalance: (user ? formatBalance(user) : '0.0000') + ' KAS',
    });
  } catch (error: any) {
    console.error('[REDEEM ERROR]', error?.message);
    res.status(500).json({ error: 'Server error' });
  }
};
