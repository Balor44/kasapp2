import { UserModel } from '../models/User';
import { createLedger, LedgerRow, LedgerStore } from './ledger';

export const mongoLedgerStore: LedgerStore = {
  async load(userId: string): Promise<LedgerRow | null> {
    const u: any = await UserModel.findById(userId).select('balanceSompi balance appliedRefs').lean();
    return u ? { balanceSompi: u.balanceSompi, balance: u.balance, appliedRefs: u.appliedRefs || [] } : null;
  },
  async apply(userId, expected, next, ref) {
    // Match on exactly what we read. For legacy rows with no balanceSompi the filter requires it to be missing.
    const balanceFilter: any =
      typeof expected.balanceSompi === 'string' ? { balanceSompi: expected.balanceSompi } : { balanceSompi: { $exists: false } };
    const res = await UserModel.updateOne(
      { _id: userId, ...balanceFilter, appliedRefs: { $ne: ref } },
      { $set: { balanceSompi: next.balanceSompi, balance: next.balance }, $push: { appliedRefs: ref } }
    );
    return res.modifiedCount === 1;
  },
};

export const ledger = createLedger(mongoLedgerStore);
