import mongoose from 'mongoose';
import { RechargeCardModel } from './src/models/RechargeCard';

const RAILWAY_MONGO = 'mongodb://mongo:AqpFCSsGPODuohggQRGHjFiTwkJPnqRx@tokaido.proxy.rlwy.net:42748/kasapp2?authSource=admin';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createTestCard() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URL || process.env.MONGODB_URI || RAILWAY_MONGO;
  await mongoose.connect(uri);

  const code = generateCode();
  const amount = 10; // KAS amount for this test card

  await RechargeCardModel.create({ code, amount, used: false });

  console.log('');
  console.log('=== TEST RECHARGE CARD CREATED ===');
  console.log('Code:', code);
  console.log('Amount:', amount, 'KAS');
  console.log('===================================');

  await mongoose.disconnect();
}

createTestCard().catch(console.error);