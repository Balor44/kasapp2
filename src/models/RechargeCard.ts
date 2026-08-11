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
 
  // --- NEW COVENANT FIELDS (Made Optional) ---
  vaultAddress?: string;
  fundingTxId?: string;
  redeemTxId?: string;
}


const RechargeCardSchema = new Schema({
  code: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  amountNaira: { type: Number },
  transactionRef: { type: String },
  purchasedByPhone: { type: String },
  used: { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
 
  // --- NEW COVENANT FIELDS (Made Optional) ---
  vaultAddress: { type: String },
  fundingTxId: { type: String },
  redeemTxId: { type: String }
});


export const RechargeCardModel = model<IRechargeCard>('RechargeCard', RechargeCardSchema);