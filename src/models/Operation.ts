import { Schema, model } from 'mongoose';

const OperationSchema = new Schema({
  key: { type: String, required: true, unique: true },
  kind: { type: String, required: true },
  state: { type: String, required: true, default: 'PENDING', index: true },
  params: { type: Schema.Types.Mixed, default: {} },
  txids: { type: [String], default: [] },
  inputs: { type: [String], default: [] },
  providerRef: { type: String },
  attempts: { type: Number, default: 0 },
  leaseUntil: { type: Number, default: 0 },
  lastError: { type: String },
  refunded: { type: Boolean, default: false },
  followedUp: { type: Boolean, default: false },
  signedAt: { type: Number },
  updatedAt: { type: Number, default: () => Date.now() },
  createdAt: { type: Number, default: () => Date.now() },
});

export const OperationModel = model('Operation', OperationSchema);
