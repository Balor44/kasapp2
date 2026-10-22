import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { balanceFields, userBalanceSompi } from '../utils/balance';

/**
 * Gives every user the exact integer balance field (balanceSompi) from the old floating point one.
 *   npm run migrate:balances              dry run
 *   npm run migrate:balances -- --apply   writes
 * Safe to re-run: users that already have balanceSompi are left alone.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.');
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await UserModel.find({ balanceSompi: { $exists: false } });
  console.log(`${users.length} user(s) need migrating.`);
  let done = 0;
  for (const user of users) {
    const fields = balanceFields(userBalanceSompi(user as any));
    if (apply) {
      const r = await UserModel.updateOne({ _id: user._id, balanceSompi: { $exists: false } }, { $set: { balanceSompi: fields.balanceSompi, balance: fields.balance } });
      if (r.modifiedCount === 1) done++;
    }
  }
  console.log(apply ? `Migrated ${done}.` : 'Dry run only. Re-run with --apply to write.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
