import { Request, Response } from 'express';
import { WaitlistModel } from '../models/Waitlist';

export const joinWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'Phone number is required' }); return; }

    const existing = await WaitlistModel.findOne({ phone });
    if (existing) {
      res.status(409).json({ error: 'Already on the waitlist', number: existing.number });
      return;
    }

    const count = await WaitlistModel.countDocuments();
    const number = count + 1;
    await WaitlistModel.create({ phone, number });

    res.status(201).json({ message: 'You are on the waitlist!', number, phone });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
