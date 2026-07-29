import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { RechargeCardModel } from '../models/RechargeCard';
import { normalizePhone } from '../utils/phone';
import { normalizeVoucherCode } from '../utils/voucherCode';

export const redeemCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone: rawPhone, code: rawCode } = req.body;
    const phone = normalizePhone(rawPhone);
    const code = normalizeVoucherCode(rawCode);
    console.log('[REDEEM DEBUG] phone:', phone, 'code:', code);

    if (!phone || !code || code.length !== 14) { 
      res.status(400).json({ error: 'phone and valid code are required' }); 
      return; 
    }

    const user = await UserModel.findOne({ phone });
    console.log('[REDEEM DEBUG] user found:', !!user);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const card = await RechargeCardModel.findOneAndUpdate(
      { code, used: false },
      { $set: { used: true, usedBy: phone, usedAt: new Date() } },
      { new: true }
    );
    console.log('[REDEEM DEBUG] card query result:', card);
    if (!card) { res.status(404).json({ error: 'Invalid or already used code' }); return; }

    user.balance += card.amount;
    await user.save();

    res.json({
      credited: card.amount.toFixed(4) + ' KAS',
      newBalance: user.balance.toFixed(4) + ' KAS',
    });
  } catch (error: any) {
    console.error('[REDEEM ERROR]', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

