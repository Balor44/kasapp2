import { Schema, model, Document } from 'mongoose';

export interface IRechargeCard extends Document {
  code: string;
  amount: number;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
}

const RechargeCardSchema = new Schema<IRechargeCard>({
  code: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true },
  used: { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
});

// Explicitly set 'rechargecards' as the third parameter to enforce collection name consistency
export const RechargeCardModel = model<IRechargeCard>('RechargeCard', RechargeCardSchema, 'rechargecards');
