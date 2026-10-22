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
  creditedAt?: Date;
  claimState?: 'CLAIMED' | 'PAYOUT' | 'FUNDING' | 'MERCHANT';
  merchantAddress?: string;
  merchantName?: string;
}


const RechargeCardSchema = new Schema({
  code: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  amountNaira: { type: Number },
  // Unique so a repeated payment webhook can never create a second voucher. Sparse because
  // vouchers created inside WhatsApp have no payment reference.
  transactionRef: { type: String, unique: true, sparse: true },
  purchasedByPhone: { type: String },
  used: { type: Boolean, default: false },
  usedBy: { type: String },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
 
  // --- NEW COVENANT FIELDS (Made Optional) ---
  vaultAddress: { type: String },
  fundingTxId: { type: String },
  redeemTxId: { type: String },
  // Set when a redeemed voucher has been credited to the user's balance (see services/vouchers.ts).
  creditedAt: { type: Date },
  // Marks vouchers claimed by the new flow, so recovery never touches vouchers redeemed before it existed.
  claimState: { type: String },
  merchantAddress: { type: String },
  merchantName: { type: String }
});


export const RechargeCardModel = model<IRechargeCard>('RechargeCard', RechargeCardSchema);