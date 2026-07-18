import mongoose, { Schema, Document } from 'mongoose';

export interface IWaitlist extends Document {
  phone: string;
  number: number;
  joinedAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>({
  phone:    { type: String, required: true, unique: true },
  number:   { type: Number, required: true },
  joinedAt: { type: Date, default: Date.now },
});

export const WaitlistModel = mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);