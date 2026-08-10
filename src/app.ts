import { Agent, setGlobalDispatcher } from 'undici';


// Extends TCP socket timeout to handle long-running node requests
setGlobalDispatcher(
  new Agent({
    connect: {
      timeout: 30000, 
    },
    headersTimeout: 60000,
    bodyTimeout: 60000,
  })
);


// Disable local proxy interference
process.env.NO_PROXY = '*';


import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}


import express from 'express';
import cors from 'cors';


// Route Imports
import waitlistRoutes from './routes/waitlist.routes';
import walletRoutes from './routes/wallet.routes';
import redeemRoutes from './routes/redeem.routes';
import messageRoutes from './routes/message.routes';
import adminRoutes from './routes/admin.routes';
import billpayRoutes from './routes/billpay.routes';
import whatsappRoutes from './routes/whatsapp.routes'; 
import paymentRoutes from './routes/payment.routes';


const app = express();


// Middleware
app.use(cors());
app.use(express.json());


// API Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/billpay', billpayRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/redeem', redeemRoutes);
app.use('/api', messageRoutes);
app.use('/api', waitlistRoutes);
app.use('/api', whatsappRoutes); 
app.use('/api', paymentRoutes);


// Health Check
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'OK', product: 'Kasapp API Engine' });
});


// Global API 404 Catch-All
app.use('*', (req: any, res: any) => {
  res.status(404).json({ error: 'Kasapp API route not found' });
});


export default app;