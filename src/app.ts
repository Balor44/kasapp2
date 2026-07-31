import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}


import express from 'express';
import fs from 'fs';
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

// Determine client static directory (check both dist-client and dist)
let distPath = path.resolve(process.cwd(), 'dist-client');
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  distPath = path.resolve(process.cwd(), 'dist');
}

// Serve static assets
app.use(express.static(distPath));

// Express 5 catch-all fallback
app.get(/(.*)/, (req: any, res: any) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("Build error: index.html was not found in static directory.");
  }
});


export default app;