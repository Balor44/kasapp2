import mongoose from 'mongoose';


const InvoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true },
  merchantPhone: { type: String, required: true },
  merchantAddress: { type: String, required: true },
  amountKas: { type: Number, required: true },
  startingBalance: { type: Number, required: true }, // Used to check if they actually got paid
  status: { type: String, default: 'pending', enum: ['pending', 'paid', 'expired'] },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-deletes after 24 hours
});


export const InvoiceModel = mongoose.model('Invoice', InvoiceSchema);


