import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { RechargeCardModel } from '../models/RechargeCard';
import { generateVoucherCode } from '../utils/voucherCode';


const MONGO_URI = process.env.MONGODB_URI;


async function generateVouchers(amount: number, count: number) {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let saved = false;
    while (!saved) {
      const code = generateVoucherCode();
      try {
        await RechargeCardModel.create({ code, amount, used: false });
        codes.push(code);
        saved = true;
      } catch (error: any) {
        if (error.code === 11000) continue; // Retry on duplicate code
        throw error;
      }
    }
  }
  return codes;
}


async function main() {
  const [, , amountArg, countArg] = process.argv;
  const amount = parseFloat(amountArg);
  const count = parseInt(countArg, 10);


  if (!amount || amount <= 0 || !count || count <= 0) {
    console.error('Usage: npx ts-node scripts/generateVouchers.ts  ');
    console.error('Example: npx ts-node scripts/generateVouchers.ts 50 5');
    process.exit(1);
  }


  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is missing from your environment variables!');
    process.exit(1);
  }


  await mongoose.connect(MONGO_URI);
  console.log(`Generating ${count} voucher(s) worth ${amount} KAS each...`);


  const codes = await generateVouchers(amount, count);
  
  const filename = `vouchers-${amount}KAS-${Date.now()}.csv`;
  const filepath = path.join(process.cwd(), filename);
  const csvContent = ['code,amount', ...codes.map(c => `${c},${amount}`)].join('\n');
  
  fs.writeFileSync(filepath, csvContent);
  console.log(`✅ Done. ${codes.length} vouchers created and saved to live database.`);
  console.log(`📄 CSV written to: ${filepath}`);


  await mongoose.disconnect();
  process.exit(0);
}


main().catch((error) => {
  console.error('❌ Voucher generation failed:', error);
  process.exit(1);
});