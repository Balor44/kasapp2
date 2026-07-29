import { Schema, model, Document, Types } from 'mongoose';


export enum SubscriptionFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}


export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  FAILED_INSUFFICIENT_FUNDS = 'FAILED_INSUFFICIENT_FUNDS',
}


export interface ISubscription extends Document {
  userPhone: string;                  // User's normalized phone number
  billerCategory: 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE';
  billerCode: string;                 // e.g., 'DSTV', 'MTN', 'AEDC'
  accountNumber: string;              // Meter number, SmartCard number, or Phone number
  amountKas: number;                  // Bill cost in KAS
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  nextDueDate: Date;
  lastRunAt?: Date;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}


const SubscriptionSchema = new Schema<ISubscription>(
  {
    userPhone: { type: String, required: true, index: true },
    billerCategory: { 
      type: String, 
      enum: ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'], 
      required: true 
    },
    billerCode: { type: String, required: true },
    accountNumber: { type: String, required: true },
    amountKas: { type: Number, required: true, min: 0 },
    frequency: { 
      type: String, 
      enum: Object.values(SubscriptionFrequency), 
      default: SubscriptionFrequency.MONTHLY 
    },
    status: { 
      type: String, 
      enum: Object.values(SubscriptionStatus), 
      default: SubscriptionStatus.ACTIVE,
      index: true 
    },
    nextDueDate: { type: Date, required: true, index: true },
    lastRunAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
  },
  { timestamps: true }
);


// Compound index for super-fast cron queries
SubscriptionSchema.index({ status: 1, nextDueDate: 1 });


export const SubscriptionModel = model<ISubscription>('Subscription', SubscriptionSchema);


