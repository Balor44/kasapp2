import { OpKind, OpState, Operation, OpStore, TERMINAL } from '../../services/ops/types';

/** In memory OpStore with the same compare and swap rules as the Mongo one. */
export function memoryOpStore(): OpStore & { ops: Map<string, Operation> } {
  const ops = new Map<string, Operation>();
  const clone = (o: Operation | undefined) => (o ? ({ ...o, txids: [...o.txids], inputs: [...o.inputs] } as Operation) : null);
  return {
    ops,
    async getOrCreate(key: string, kind: OpKind, params: Record<string, any>) {
      if (!ops.has(key)) {
        ops.set(key, { key, kind, state: 'PENDING', params, txids: [], inputs: [], attempts: 0, leaseUntil: 0, updatedAt: Date.now(), createdAt: Date.now() });
      }
      return clone(ops.get(key))!;
    },
    async get(key: string) {
      return clone(ops.get(key));
    },
    async lease(key: string, now: number, ttlMs: number) {
      const op = ops.get(key);
      if (!op || TERMINAL.includes(op.state) || (op.leaseUntil || 0) > now) return null;
      op.leaseUntil = now + ttlMs;
      return clone(op);
    },
    async transition(key: string, from: OpState, patch: Partial<Operation>) {
      const op = ops.get(key);
      if (!op || op.state !== from) return false;
      Object.assign(op, patch);
      return true;
    },
    async release(key: string) {
      const op = ops.get(key);
      if (op) op.leaseUntil = 0;
    },
    async listOpen(now: number, limit: number) {
      return [...ops.values()].filter((o) => !TERMINAL.includes(o.state) && (o.leaseUntil || 0) <= now).slice(0, limit).map((o) => clone(o)!);
    },
    async markRefunded(key: string) {
      const op = ops.get(key);
      if (!op || op.refunded) return false;
      op.refunded = true;
      return true;
    },
    async listUnfollowed(limit: number) {
      return [...ops.values()].filter((o) => TERMINAL.includes(o.state) && !o.followedUp && o.params?.next).slice(0, limit).map((o) => clone(o)!);
    },
    async markFollowed(key: string) {
      const op = ops.get(key);
      if (!op || op.followedUp) return false;
      op.followedUp = true;
      return true;
    },
  };
}
