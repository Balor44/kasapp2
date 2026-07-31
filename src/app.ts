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
// FRONTEND STATIC SERVING (MULTI-PATH GUARD)
// --------------------------------------------------------------------------

// List potential candidate directories where index.html might land
const candidates = [
  path.resolve(process.cwd(), 'dist-client'),
  path.resolve(process.cwd(), 'client', 'dist-client'),
  path.resolve(process.cwd(), 'dist'),
  path.join(__dirname, '../dist-client'),
  path.join(__dirname, '../dist'),
];

// Find the first directory that actually contains index.html
let distPath = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || candidates[0];

console.log(`[Kasapp Static] Serving frontend assets from: ${distPath}`);

// Serve static assets from resolved directory
app.use(express.static(distPath));

// Express 5 catch-all fallback
app.get(/(.*)/, (req: any, res: any) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // Re-verify in case build was updated dynamically
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  // Fallback search across candidates if distPath was moved
  for (const cand of candidates) {
    const fallbackIndex = path.join(cand, 'index.html');
    if (fs.existsSync(fallbackIndex)) {
      return res.sendFile(fallbackIndex);
    }
  }

  res.status(500).send(`Build error: index.html was not found. Checked: ${candidates.join(', ')}`);
});


export default app;