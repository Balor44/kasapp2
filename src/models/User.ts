import mongoose, { Schema, Document } from 'mongoose';

// src/models/User.ts
export interface IUser extends Document {
  phone: string;
  walletAddress?: string;
  wallet?: string;
  mnemonic: string;
  balance: number;
  balanceSompi?: string;
  appliedRefs?: string[];
  pin?: string;
}


const UserSchema = new Schema<IUser>({
  phone: { type: String, required: true, unique: true },
  walletAddress: { type: String },
  wallet: { type: String },
  mnemonic: { type: String, required: true },
  balance: { type: Number, default: 0 },
  // Exact balance in whole sompi, as a string. `balance` is kept only for display and old code.
  balanceSompi: { type: String },
  // Idempotency references of balance changes already applied (see services/ledger.ts).
  appliedRefs: { type: [String], default: [] },
  pin: { type: String, default: null }
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);