import { Request, Response } from 'express';
import { KaspaService } from '../wallet/kaspa.service';

export const getOperatorBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const address = process.env.OPERATOR_WALLET_ADDRESS;
    if (!address) {
      res.status(500).json({ error: 'OPERATOR_WALLET_ADDRESS not set' });
      return;
    }

    const balance = await KaspaService.getBalance(address);
    res.json({ address, balance: balance.toFixed(4) + ' KAS' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};