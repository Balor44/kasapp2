import mongoose, { Schema, Document } from 'mongoose';

export interface IRechargeCard extends Document {
  code: string;
  amount: number;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
}

const RechargeCardSchema = new Schema<IRechargeCard>({
  code:   { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  used:   { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
});

export const RechargeCardModel = mongoose.model<IRechargeCard>('RechargeCard', RechargeCardSchema);