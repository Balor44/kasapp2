import { balanceFields, userBalanceSompi } from '../utils/balance';

/** One user's balance state as the ledger sees it. */
export interface LedgerRow {
  balanceSompi?: string | null;
  balance?: number | null;
  appliedRefs?: string[];
}

export interface LedgerStore {
  load(userId: string): Promise<LedgerRow | null>;
  /**
   * Single document atomic update. Applies only if the stored balance still equals `expected`
   * AND `ref` is not already in appliedRefs. Returns true if applied.
   */
  apply(userId: string, expected: LedgerRow, next: { balanceSompi: string; balance: number }, ref: string): Promise<boolean>;
}

export type AdjustResult = 'APPLIED' | 'DUPLICATE' | 'INSUFFICIENT' | 'NO_USER';

/**
 * Exactly once balance changes. The `ref` (for example "refund:<opKey>" or "voucher:<code>") is
 * written in the same atomic update as the new balance, so retrying after a crash can never apply
 * a change twice and can never lose it.
 */
export function createLedger(store: LedgerStore, maxRetries = 8) {
  async function adjust(userId: string, deltaSompi: bigint, ref: string): Promise<AdjustResult> {
    for (let i = 0; i < maxRetries; i++) {
      const row = await store.load(userId);
      if (!row) return 'NO_USER';
      if ((row.appliedRefs || []).includes(ref)) return 'DUPLICATE';
      const current = userBalanceSompi(row);
      const next = current + deltaSompi;
      if (next < 0n) return 'INSUFFICIENT';
      if (await store.apply(userId, row, balanceFields(next), ref)) return 'APPLIED';
      // Lost a race with another writer: reload and try again.
    }
    throw new Error('Balance update kept conflicting, try again.');
  }
  return {
    adjust,
    credit: (userId: string, sompi: bigint, ref: string) => adjust(userId, sompi, ref),
    debit: (userId: string, sompi: bigint, ref: string) => adjust(userId, -sompi, ref),
  };
}

export type Ledger = ReturnType<typeof createLedger>;
