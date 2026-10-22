import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { encryptMnemonic, decryptMnemonic } from '../utils/crypto.utils';

/**
 * Encrypts any wallet seed still stored as a plain phrase (words separated by spaces).
 *   npm run migrate:seeds           shows what would change, changes nothing
 *   npm run migrate:seeds -- --apply   encrypts, and verifies each result decrypts back before saving
 * Take a database backup first.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.');
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await UserModel.find({ mnemonic: /\s/ });
  console.log(`${users.length} wallet(s) still store a plain seed phrase.`);
  let done = 0;
  for (const user of users) {
    if (!apply) continue;
    const cipher = encryptMnemonic(user.mnemonic, key);
    if (decryptMnemonic(cipher, key) !== user.mnemonic) {
      console.error(`Skipped ${user._id}: round trip check failed.`);
      continue;
    }
    await UserModel.updateOne({ _id: user._id, mnemonic: user.mnemonic }, { $set: { mnemonic: cipher } });
    done++;
  }
  console.log(apply ? `Encrypted ${done}.` : 'Dry run only. Re-run with --apply to encrypt.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
