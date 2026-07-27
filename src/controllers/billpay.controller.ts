import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { BillPayService } from '../services/billpay.service';
import { nairaToKAS } from '../utils/price';

async function handleBillPayment(
  req: Request,
  res: Response,
  serviceFn: (target: string, amount: number, provider: string) => Promise<any>,
  targetField: string
): Promise<void> {
  try {
    const { phone, amount, provider } = req.body;
    const target = req.body[targetField];

    if (!phone || !target || !amount || !provider) {
      res.status(400).json({ error: 'phone, ' + targetField + ', amount, and provider are required' });
      return;
    }

    const user = await UserModel.findOne({ phone });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const requiredKAS = await nairaToKAS(amount);
    if (user.balance < requiredKAS) {
      res.status(400).json({ error: 'Insufficient balance. Need ' + requiredKAS.toFixed(4) + ' KAS' });
      return;
    }

    const result = await serviceFn(target, amount, provider);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    user.balance -= requiredKAS;
    await user.save();

    res.json({
      status: 'success',
      reference: result.reference,
      message: result.message,
      deducted: requiredKAS.toFixed(4) + ' KAS',
      newBalance: user.balance.toFixed(4) + ' KAS',
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
}

export const buyAirtime = (req: Request, res: Response) =>
  handleBillPayment(req, res, BillPayService.buyAirtime, 'targetPhone');

export const payElectricity = (req: Request, res: Response) =>
  handleBillPayment(req, res, BillPayService.payElectricity, 'meterNumber');

export const payWater = (req: Request, res: Response) =>
  handleBillPayment(req, res, BillPayService.payWater, 'accountNumber');

export const payCable = (req: Request, res: Response) =>
  handleBillPayment(req, res, BillPayService.payCable, 'smartcardNumber');