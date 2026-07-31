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
import adminRoutes from './routes/admin.routes';
import billpayRoutes from './routes/billpay.routes';


const app = express();
app.use(cors());
app.use(express.json());


// API Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/billpay', billpayRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/redeem', redeemRoutes);
app.use('/api', messageRoutes);
app.use('/api', waitlistRoutes);


app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'OK', product: 'Kasapp' });
});


// --------------------------------------------------------------------------
// FRONTEND STATIC SERVING
// --------------------------------------------------------------------------

// Point to the dedicated frontend directory
const distPath = path.resolve(process.cwd(), 'dist-client');

app.use(express.static(distPath));

// Express 5 catch-all fallback
app.get(/(.*)/, (req: any, res: any) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});


export default app;