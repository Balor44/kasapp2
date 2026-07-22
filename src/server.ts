import app from './app';
import { connectDB } from './database/connect';

const PORT = process.env.PORT || 3000;
console.log(process.env);
console.log('VERIFY TOKEN', process.env.WHATSAPP_VERIFY_TOKEN);

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log('Kasapp is running');
    console.log('http://localhost:' + PORT + '/health');
  });
};

start();