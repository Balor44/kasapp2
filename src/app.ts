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
import { parseAllowedOrigins } from './utils/corsOrigins';
import mongoose from 'mongoose';
import { redisClient } from './services/userState.service';


const app = express();

// CORS: set CORS_ORIGINS to a comma separated list (for example https://mykasapp.com) to restrict
// browser access. When it is not set the previous behaviour (any origin) is kept.
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);
app.use(allowedOrigins ? cors({ origin: allowedOrigins }) : cors());


// ==========================================================================
// CRITICAL: Mount WhatsApp routes BEFORE express.json()
// This ensures the Meta webhook can receive the raw Buffer for signature verification.
// ==========================================================================
app.use('/api/whatsapp', whatsappRoutes);


// Global JSON parser for all other routes.
// The Paystack webhook signature is computed over the exact raw bytes, so keep them for that route only.
app.use(
  express.json({
    limit: '100kb',
    verify: (req: any, _res: any, buf: Buffer) => {
      if (typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api/webhooks/paystack')) {
        req.rawBody = buf;
      }
    },
  })
);


// ==========================================================================
// PUBLIC API ROUTES (Frontend accessible)
// ==========================================================================
app.use('/api', waitlistRoutes);
app.use('/api', paymentRoutes);


// ==========================================================================
// PROTECTED API ROUTES (Admin Key strictly required)
// ==========================================================================
app.use('/api/wallet', requireAdminKey, walletRoutes);
app.use('/api/billpay', requireAdminKey, billpayRoutes);
app.use('/api/merchant', requireAdminKey, merchantRoutes);
app.use('/api/admin', requireAdminKey, adminRoutes);
app.use('/api/redeem', requireAdminKey, redeemRoutes);
app.use('/api', requireAdminKey, messageRoutes);


// Isolated merchant endpoint
app.post(`/api/v1/merchant/redeem`, requireAdminKey, redeemMerchantVoucher);


// Liveness: the process is up. Keep this simple so a platform health check never restarts the app
// because of a temporary database or Redis problem.
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'OK', product: 'Kasapp' });
});


// Readiness: critical dependencies are reachable. Returns 503 when something is down.
app.get('/ready', async (_req: any, res: any) => {
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

  const checks: Record<string, boolean> = {
    mongo: mongoose.connection.readyState === 1,
    redis: false,
  };

  try {
    checks.redis = (await withTimeout(redisClient.ping(), 2000)) === 'PONG';
  } catch {
    checks.redis = false;
  }

  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY', checks });
});


// --------------------------------------------------------------------------
// Global API 404 Catch-All (Express 5 Safe - NO ASTERISK)
// --------------------------------------------------------------------------
app.use((req: any, res: any) => {
  res.status(404).json({ error: 'API route not found' });
});


export default app;


