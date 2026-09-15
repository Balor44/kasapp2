import { Agent, setGlobalDispatcher } from 'undici';


// Extends TCP socket timeout from default 10s to 30s
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
import merchantRoutes from './routes/merchant.routes';
import { redeemMerchantVoucher } from './controllers/merchant.controller';
import { requireAdminKey } from './middleware/auth.middleware';

const app = express();
app.use(cors());


// ==========================================================================
// CRITICAL: Mount WhatsApp routes BEFORE express.json()
// This ensures the Meta webhook can receive the raw Buffer for signature verification.
// ==========================================================================
app.use('/api/whatsapp', whatsappRoutes);


// Global JSON parser for all other routes
app.use(express.json());


// API Routes
app.use('/api/wallet', requireAdminKey, walletRoutes);
app.use('/api/billpay', requireAdminKey, billpayRoutes);
app.use('/api/merchant', requireAdminKey, merchantRoutes);
app.use('/api/admin', requireAdminKey, adminRoutes);
app.use('/api/redeem', requireAdminKey, redeemRoutes);
app.use('/api', requireAdminKey, messageRoutes);
app.use('/api', requireAdminKey, waitlistRoutes);
app.use('/api', requireAdminKey, paymentRoutes);



app.post(`/api/v1/merchant/redeem`, redeemMerchantVoucher);


app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'OK', product: 'Kasapp' });
});


// --------------------------------------------------------------------------
// Global API 404 Catch-All (Express 5 Safe - NO ASTERISK)
// --------------------------------------------------------------------------
app.use((req: any, res: any) => {
  res.status(404).json({ error: 'API route not found' });
});


export default app;