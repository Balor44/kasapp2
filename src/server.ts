import app from './app';
import { connectDB } from './database/connect';
import { initRecurringPaymentsCron } from './jobs/recurringPayments.cron';


const PORT = process.env.PORT || 3000;


// Validate critical security environment variables on startup without logging values
const requiredEnv = ['ENCRYPTION_KEY', 'MONGODB_URI'];
for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}


initRecurringPaymentsCron();


const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Kasapp] Server running on port ${PORT}`);
    console.log(`[Kasapp] Health check at http://localhost:${PORT}/health`);
  });
};


start();


