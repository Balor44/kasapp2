import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';


// Direct inline schema definition to completely bypass import resolution errors
const RechargeCardSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  used: { type: Boolean, default: false },
  usedBy: { type: String, default: null },
  usedAt: { type: Date, default: null },
  vaultAddress: { type: String, default: '' },
  fundingTxId: { type: String, default: '' }
});


const RechargeCardModel = mongoose.models.RechargeCard || mongoose.model('RechargeCard', RechargeCardSchema);


// High-entropy 16-character code generator
function generateVoucherCode(): string {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KASP-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}


async function main() {
  const [, , amountArg, countArg] = process.argv;
  const amount = parseFloat(amountArg);
  const count = parseInt(countArg, 10);


  if (!amount || amount <= 0 || !count || count <= 0) {
    console.error('Usage: npx ts-node generate-vouchers.ts  ');
    console.error('Example: npx ts-node generate-vouchers.ts 50 5');
    process.exit(1);
  }


  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing from your .env file!');
    process.exit(1);
  }


  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB. Generating ${count} voucher(s) worth ${amount} KAS each...`);


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
        if (error.code === 11000) continue; // Retry on duplicate
        throw error;
      }
    }
  }


  const filename = `vouchers-${amount}KAS-${Date.now()}.csv`;
  const filepath = path.join(process.cwd(), filename);
  const csvContent = ['code,amount', ...codes.map(c => `${c},${amount}`)].join('\n');
  
  fs.writeFileSync(filepath, csvContent);
  console.log(`✅ Done! ${codes.length} vouchers created and saved to live database.`);
  console.log(`📄 CSV written to: ${filepath}`);
  console.log(`\nSample Code to test on WhatsApp:\n👉 redeem ${codes[0]}\n`);


  await mongoose.disconnect();
  process.exit(0);
}


main().catch((error) => {
  console.error('❌ Generation failed:', error);
  process.exit(1);
});