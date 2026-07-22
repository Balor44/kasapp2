import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  wallet: string;
  mnemonic?: string;
  balance: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  phone:     { type: String, required: true, unique: true },
  wallet:    { type: String, required: true, unique: true },
  mnemonic:  { type: String },
  balance:   { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);