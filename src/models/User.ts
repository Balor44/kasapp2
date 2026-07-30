import mongoose, { Schema, Document } from 'mongoose';

// src/models/User.ts
export interface IUser extends Document {
  phone: string;
  walletAddress?: string;
  wallet?: string;
  mnemonic: string;
  balance: number;
  pin?: string;
}


const UserSchema = new Schema<IUser>({
  phone: { type: String, required: true, unique: true },
  walletAddress: { type: String },
  wallet: { type: String },
  mnemonic: { type: String, required: true },
  balance: { type: Number, default: 0 },
  pin: { type: String, default: null }
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);