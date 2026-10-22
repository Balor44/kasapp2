import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, LedgerRow, LedgerStore } from '../services/ledger';

function fakeStore(initial: LedgerRow) {
  const rows = new Map<string, LedgerRow>([['u1', { ...initial, appliedRefs: [...(initial.appliedRefs || [])] }]]);
  let beforeApply: (() => void) | null = null;
  const store: LedgerStore = {
    async load(id) { const r = rows.get(id); return r ? { ...r, appliedRefs: [...(r.appliedRefs || [])] } : null; },
    async apply(id, expected, next, ref) {
      beforeApply?.(); beforeApply = null;
      const r = rows.get(id)!;
      const same = (typeof expected.balanceSompi === 'string' ? r.balanceSompi === expected.balanceSompi : r.balanceSompi === undefined);
      if (!same || (r.appliedRefs || []).includes(ref)) return false;
      r.balanceSompi = next.balanceSompi; r.balance = next.balance; r.appliedRefs = [...(r.appliedRefs || []), ref];
      return true;
    },
  };
  return { store, rows, onNextApply: (fn: () => void) => { beforeApply = fn; } };
}

describe('ledger', () => {
  it('credits exactly once per ref', async () => {
    const f = fakeStore({ balanceSompi: '100' });
    const l = createLedger(f.store);
    assert.equal(await l.credit('u1', 50n, 'voucher:A'), 'APPLIED');
    assert.equal(await l.credit('u1', 50n, 'voucher:A'), 'DUPLICATE');
    assert.equal(f.rows.get('u1')!.balanceSompi, '150');
  });
  it('never goes negative', async () => {
    const f = fakeStore({ balanceSompi: '10' });
    const l = createLedger(f.store);
    assert.equal(await l.debit('u1', 11n, 'd1'), 'INSUFFICIENT');
    assert.equal(f.rows.get('u1')!.balanceSompi, '10');
  });
  it('retries when another writer changes the balance in between', async () => {
    const f = fakeStore({ balanceSompi: '100' });
    const l = createLedger(f.store);
    f.onNextApply(() => { f.rows.get('u1')!.balanceSompi = '200'; });
    assert.equal(await l.credit('u1', 5n, 'c1'), 'APPLIED');
    assert.equal(f.rows.get('u1')!.balanceSompi, '205');
  });
  it('migrates a legacy float row on first change, exactly', async () => {
    const f = fakeStore({ balance: 0.1 });
    const l = createLedger(f.store);
    await l.credit('u1', 20000000n, 'c2');
    assert.equal(f.rows.get('u1')!.balanceSompi, '30000000');
  });
  it('unknown user', async () => {
    const f = fakeStore({ balanceSompi: '1' });
    assert.equal(await createLedger(f.store).credit('nope', 1n, 'x'), 'NO_USER');
  });
});
