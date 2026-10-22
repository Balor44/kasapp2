import { OperationModel } from "../../models/Operation";
import { OpKind, OpState, Operation, OpStore, TERMINAL } from "./types";

const plain = (doc: any): Operation | null => (doc ? (doc.toObject ? doc.toObject() : doc) : null);

/** MongoDB backed store. Every transition is a single atomic findOneAndUpdate guarded by state. */
export const mongoOpStore: OpStore = {
  async getOrCreate(key: string, kind: OpKind, params: Record<string, any>) {
    const create = () =>
      OperationModel.findOneAndUpdate(
        { key },
        { $setOnInsert: { key, kind, params, state: "PENDING", createdAt: Date.now(), updatedAt: Date.now() } },
        { upsert: true, new: true }
      );
    try {
      return plain(await create()) as Operation;
    } catch (err: any) {
      // Two workers upserting the same new key at once: one gets a duplicate key error. Read the winner.
      if (err?.code === 11000) return plain(await OperationModel.findOne({ key })) as Operation;
      throw err;
    }
  },
  async get(key: string) {
    return plain(await OperationModel.findOne({ key }));
  },
  async lease(key: string, now: number, ttlMs: number) {
    const doc = await OperationModel.findOneAndUpdate(
      { key, state: { $nin: TERMINAL }, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
      { $set: { leaseUntil: now + ttlMs } },
      { new: true }
    );
    return plain(doc);
  },
  async transition(key: string, from: OpState, patch: Partial<Operation>) {
    const doc = await OperationModel.findOneAndUpdate({ key, state: from }, { $set: patch }, { new: true });
    return !!doc;
  },
  async release(key: string) {
    await OperationModel.updateOne({ key }, { $set: { leaseUntil: 0 } });
  },
  async listOpen(now: number, limit: number) {
    const docs = await OperationModel.find({ state: { $nin: TERMINAL }, leaseUntil: { $lte: now } })
      .sort({ updatedAt: 1 })
      .limit(limit);
    return docs.map((d: any) => plain(d) as Operation);
  },
  async markRefunded(key: string) {
    const doc = await OperationModel.findOneAndUpdate({ key, refunded: { $ne: true } }, { $set: { refunded: true } });
    return !!doc;
  },
  async listUnfollowed(limit: number) {
    const docs = await OperationModel.find({
      state: { $in: TERMINAL },
      followedUp: { $ne: true },
      "params.next": { $exists: true },
    }).limit(limit);
    return docs.map((d: any) => plain(d) as Operation);
  },
  async markFollowed(key: string) {
    const doc = await OperationModel.findOneAndUpdate({ key, followedUp: { $ne: true } }, { $set: { followedUp: true } });
    return !!doc;
  },
};
