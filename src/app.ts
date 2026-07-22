import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import waitlistRoutes from './routes/waitlist.routes';
import walletRoutes from './routes/wallet.routes';
import redeemRoutes from './routes/redeem.routes';
import messageRoutes from './routes/message.routes'; 

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/wallet', walletRoutes);
app.use('/api/redeem', redeemRoutes);
app.use('/api', messageRoutes);

app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'OK', product: 'Kasapp' });
});

app.use('/api', waitlistRoutes);

app.use(express.static(path.join(__dirname, '../public')));
app.get('/{*path}', (_req: any, res: any) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

export default app;