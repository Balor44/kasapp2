import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { KaspaService } from '../wallet/kaspa.service';

export const createWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'phone is required' }); return; }

    const existing = await UserModel.findOne({ phone });
    if (existing) { res.status(409).json({ error: 'Wallet already exists' }); return; }

    const { publicKey, secret } = await KaspaService.generateWallet();
    const user = await UserModel.create({ 
        phone, 
        wallet: publicKey,
        mnemonic: secret, 
        balance: 0,
    });

    res.status(201).json({ phone: user.phone, wallet: publicKey, balance: 0 });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.params;
    const user = await UserModel.findOne({ phone });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const liveBalance = await KaspaService.getBalance(user.wallet);
    res.json({ wallet: user.wallet, balance: liveBalance.toFixed(4) + ' KAS' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const sendMoney = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, amount } = req.body;
    if (!from || !to || !amount) { res.status(400).json({ error: 'from, to, and amount are required' }); return; }

    const sender = await UserModel.findOne({ phone: from });
    const receiver = await UserModel.findOne({ phone: to });
    if (!sender) { res.status(404).json({ error: 'Sender not found' }); return; }
    if (!receiver) { res.status(404).json({ error: 'Recipient not found' }); return; }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { res.status(400).json({ error: 'Invalid amount' }); return; }
    if (!sender.mnemonic) { res.status(400).json({ error: 'Sender wallet missing key material' }); return; }

    const txid = await KaspaService.sendKAS(sender.mnemonic, receiver.wallet, amt);
    res.json({ status: 'success', txid });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};