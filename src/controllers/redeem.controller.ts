import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { RechargeCardModel } from '../models/RechargeCard';
import { KaspaService } from '../wallet/kaspa.service';

const OPERATOR_MNEMONIC = process.env.OPERATOR_WALLET_MNEMONIC!;

export const redeemCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, code } = req.body;
    console.log('[REDEEM DEBUG] phone:', phone, 'code:', code);

    if (!phone || !code) { res.status(400).json({ error: 'phone and code are required' }); return; }

    const user = await UserModel.findOne({ phone });
    console.log('[REDEEM DEBUG] user found:', !!user);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const card = await RechargeCardModel.findOne({ code, used: false });
    console.log('[REDEEM DEBUG] card query result:', card);
    if (!card) { res.status(404).json({ error: 'Invalid or already used code' }); return; }

    const txid = await KaspaService.sendKAS(OPERATOR_MNEMONIC, user.wallet, card.amount);

    card.used = true;
    card.usedBy = phone;
    card.usedAt = new Date();
    await card.save();

    user.balance += card.amount;
    await user.save();

    res.json({
      credited: card.amount.toFixed(4) + ' KAS',
      newBalance: user.balance.toFixed(4) + ' KAS',
      txid,
    });
  } catch (error: any) {
    console.error('[REDEEM ERROR]', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};