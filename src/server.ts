import app from './app';
import { connectDB } from './database/connect';
import { initRecurringPaymentsCron } from './jobs/recurringPayments.cron';

const PORT = process.env.PORT || 3000;
console.log(process.env);
console.log('VERIFY TOKEN', process.env.WHATSAPP_VERIFY_TOKEN);
initRecurringPaymentsCron();

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log('Kasapp is running');
    console.log('http://localhost:' + PORT + '/health');
  });
};

start();