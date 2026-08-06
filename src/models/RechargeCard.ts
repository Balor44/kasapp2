import { Schema, model, Document } from 'mongoose';

export interface IRechargeCard extends Document {
  code: string;
  amount: number; // Amount in KAS
  amountNaira?: number; // Amount in NGN
  transactionRef?: string;
  purchasedByPhone?: string;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
  createdAt: Date;
}

const RechargeCardSchema = new Schema<IRechargeCard>({
  code: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  amountNaira: { type: Number },
  transactionRef: { type: String },
  purchasedByPhone: { type: String },
  used: { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const RechargeCardModel = model<IRechargeCard>('RechargeCard', RechargeCardSchema);