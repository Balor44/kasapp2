import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';


export const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_API_KEY || '';


  if (!apiKey || !expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }


  // Convert both to buffers to use timingSafeEqual
  const apiKeyBuffer = Buffer.from(apiKey);
  const expectedKeyBuffer = Buffer.from(expectedKey);


  // If lengths don't match, timingSafeEqual will crash, so we check length first
  if (apiKeyBuffer.length !== expectedKeyBuffer.length || !crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
 
  next();
};


