/**
 * Batch-generates redeemable KAS vouchers.
 *
 * Usage:
 *   ts-node src/scripts/generateVouchers.ts <amount> <count>
 *
 * Example — generate 100 vouchers worth 5 KAS each:
 *   ts-node src/scripts/generateVouchers.ts 5 100
 *
 * Writes a CSV of the generated codes to ./vouchers-<amount>KAS-<timestamp>.csv
 * so they can be handed to agents / printed / distributed. Codes are also
 * saved to RechargeCardModel so they're immediately redeemable in-app.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { RechargeCardModel } from '../models/RechargeCard';
import { generateVoucherCode } from '../utils/voucherCode';

async function generateVouchers(amount: number, count: number): Promise<string[]> {
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
        // Duplicate code (extremely rare given the code space) — just retry with a new one.
        if (error.code === 11000) continue;
        throw error;
      }
    }
  }

  return codes;
}

async function main() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No database connection string found in .env (checked DATABASE_URL, MONGO_URL, MONGODB_URI, MONGO_URI).');
    process.exit(1);
  }

  const [, , amountArg, countArg] = process.argv;
  const amount = parseFloat(amountArg);
  const count = parseInt(countArg, 10);

  if (!amount || amount <= 0 || !count || count <= 0) {
    console.error('Usage: ts-node src/scripts/generateVouchers.ts <amount> <count>');
    console.error('Example: ts-node src/scripts/generateVouchers.ts 5 100');
    process.exit(1);
  }

  await mongoose.connect(uri, {dbName: 'kasapp2' });
  console.log(`Generating ${count} voucher(s) worth ${amount} KAS each...`);

  const codes = await generateVouchers(amount, count);

  const filename = `vouchers-${amount}KAS-${Date.now()}.csv`;
  const filepath = path.join(process.cwd(), filename);
  const csvContent = ['code,amount', ...codes.map(c => `${c},${amount}`)].join('\n');
  fs.writeFileSync(filepath, csvContent);

  console.log(`Done. ${codes.length} vouchers created and saved to the database.`);
  console.log(`Codes written to: ${filepath}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Voucher generation failed:', error);
  process.exit(1);
});

