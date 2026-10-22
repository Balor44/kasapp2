import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../services/ops/engine';
import { Chain, BillProvider } from '../services/ops/types';
import { NotSubmittedError, UnknownSubmitError } from '../utils/chainErrors';
import { memoryOpStore } from './helpers/memoryOpStore';

const params = { fromWallet: 'enc', fromAddress: 'kaspa:qqfrom', toAddress: 'kaspa:qqto', amountSompi: '500000000' };

function setup(chainOver: Partial<Chain> = {}, providerOver: Partial<BillProvider> = {}) {
  let clock = 1_000_000;
  const sends: string[] = [];
  const refunds: string[] = [];
  const alerts: string[] = [];
  const store = memoryOpStore();
  const chain: Chain = {
    async sendSompi(_f, _t, _a, hooks) {
      const txid = 'tx' + (sends.length + 1);
      await hooks.onBeforeSubmit({ txid, inputs: ['in:0'] });
      sends.push(txid);
      return { txid, txids: [txid] };
    },
    async checkPayment() { return 'NOT_FOUND'; },
    async checkInputs() { return 'ALL_UNSPENT'; },
    ...chainOver,
  };
  const payCalls: string[] = [];
  const provider: BillProvider = {
    async pay(id) { payCalls.push(id); return 'DELIVERED'; },
    async requery() { return 'PENDING'; },
    ...providerOver,
  };
  const engine = createEngine({
    store, chain, provider, now: () => clock, settleMs: 1000, leaseMs: 500,
    onRefund: async (op) => { refunds.push(op.key); },
    alert: (m) => alerts.push(m),
  });
  return { engine, store, sends, refunds, alerts, payCalls, tick: (ms: number) => { clock += ms; } };
}

describe('payout operations', () => {
  it('confirms and is idempotent for the same key', async () => {
    const t = setup();
    const a = await t.engine.execute('p1', 'PAYOUT', params);
    const b = await t.engine.execute('p1', 'PAYOUT', params);
    assert.equal(a.state, 'CONFIRMED');
    assert.equal(b.state, 'CONFIRMED');
    assert.equal(t.sends.length, 1);
  });

  it('concurrent executes of one key send once', async () => {
    const t = setup();
    await Promise.all([t.engine.execute('p2', 'PAYOUT', params), t.engine.execute('p2', 'PAYOUT', params), t.engine.execute('p2', 'PAYOUT', params)]);
    assert.equal(t.sends.length, 1);
  });

  it('unknown broadcast stays SIGNED, never refunds, then confirms when chain shows payment', async () => {
    let paid = false;
    const t = setup({
      async sendSompi(_f, _t, _a, hooks) {
        await hooks.onBeforeSubmit({ txid: 'txA', inputs: ['in:0'] });
        throw new UnknownSubmitError('timeout');
      },
      async checkPayment() { return paid ? 'PAID' : 'UNKNOWN'; },
    });
    const op = await t.engine.execute('p3', 'PAYOUT', params);
    assert.equal(op.state, 'SIGNED');
    assert.deepEqual(op.txids, ['txA']);
    assert.equal(t.refunds.length, 0);
    paid = true;
    await t.engine.sweep();
    assert.equal((await t.store.get('p3'))!.state, 'CONFIRMED');
    assert.equal(t.refunds.length, 0);
  });

  it('not found is only FAILED after the settle window and with all inputs unspent, refunding exactly once', async () => {
    const t = setup({
      async sendSompi(_f, _t, _a, hooks) {
        await hooks.onBeforeSubmit({ txid: 'txB', inputs: ['in:0'] });
        throw new UnknownSubmitError('lost');
      },
    });
    await t.engine.execute('p4', 'PAYOUT', params);
    await t.engine.sweep();
    assert.equal((await t.store.get('p4'))!.state, 'SIGNED', 'too early to give up');
    t.tick(2000);
    await t.engine.sweep();
    await t.engine.sweep();
    assert.equal((await t.store.get('p4'))!.state, 'FAILED');
    assert.deepEqual(t.refunds, ['p4']);
  });

  it('spent inputs without a visible payment go to NEEDS_REVIEW with no refund', async () => {
    const t = setup({
      async sendSompi(_f, _t, _a, hooks) {
        await hooks.onBeforeSubmit({ txid: 'txC', inputs: ['in:0'] });
        throw new UnknownSubmitError('lost');
      },
      async checkInputs() { return 'ALL_SPENT'; },
    });
    await t.engine.execute('p5', 'PAYOUT', params);
    t.tick(2000);
    await t.engine.sweep();
    assert.equal((await t.store.get('p5'))!.state, 'NEEDS_REVIEW');
    assert.equal(t.refunds.length, 0);
    assert.equal(t.alerts.length, 1);
  });

  it('an unreadable chain lookup never leads to a refund, even long after signing', async () => {
    const t = setup({
      async sendSompi(_f, _t, _a, hooks) {
        await hooks.onBeforeSubmit({ txid: 'txF', inputs: ['in:0'] });
        throw new UnknownSubmitError('lost');
      },
      async checkPayment() { return 'UNKNOWN'; },
    });
    await t.engine.execute('p9', 'PAYOUT', params);
    t.tick(10_000_000);
    await t.engine.sweep();
    assert.equal((await t.store.get('p9'))!.state, 'SIGNED');
    assert.equal(t.refunds.length, 0);
  });

  it('a definite NotSubmittedError fails and refunds once', async () => {
    const t = setup({ async sendSompi() { throw new NotSubmittedError('no funds', 'INSUFFICIENT_FUNDS'); } });
    const op = await t.engine.execute('p6', 'PAYOUT', params);
    assert.equal(op.state, 'FAILED');
    await t.engine.advance(op);
    assert.deepEqual(t.refunds, ['p6']);
  });

  it('a retryable NotSubmittedError stays PENDING and is retried by the sweep', async () => {
    let calls = 0;
    const t = setup({
      async sendSompi(_f, _t, _a, hooks) {
        calls++;
        if (calls === 1) throw new NotSubmittedError('node syncing', 'NODE_NOT_READY', true);
        await hooks.onBeforeSubmit({ txid: 'txD', inputs: ['in:0'] });
        return { txid: 'txD', txids: ['txD'] };
      },
    });
    const op = await t.engine.execute('p7', 'PAYOUT', params);
    assert.equal(op.state, 'PENDING');
    await t.engine.sweep();
    assert.equal((await t.store.get('p7'))!.state, 'CONFIRMED');
    assert.equal(calls, 2);
  });

  it('a failed write ahead record means nothing is broadcast', async () => {
    const store = memoryOpStore();
    let broadcast = 0;
    const engine = createEngine({
      store,
      chain: {
        async sendSompi(_f, _t, _a, hooks) {
          await hooks.onBeforeSubmit({ txid: 'txE', inputs: [] });
          broadcast++;
          return { txid: 'txE', txids: ['txE'] };
        },
        async checkPayment() { return 'NOT_FOUND'; },
        async checkInputs() { return 'ALL_UNSPENT'; },
      },
    });
    await store.getOrCreate('p8', 'PAYOUT', params);
    store.transition = async () => false; // simulate losing the race
    await engine.execute('p8', 'PAYOUT', params);
    assert.equal(broadcast, 0);
  });
});

describe('bill operations', () => {
  it('delivers once and never pays twice for the same key', async () => {
    const t = setup();
    await t.engine.execute('b1', 'BILL', { amount: 1000 });
    await t.engine.execute('b1', 'BILL', { amount: 1000 });
    assert.equal(t.payCalls.length, 1);
    assert.equal((await t.store.get('b1'))!.state, 'DELIVERED');
  });

  it('a provider timeout is not a failure: no refund, requery decides, no second pay', async () => {
    let answer: 'PENDING' | 'DELIVERED' = 'PENDING';
    const t = setup({}, {
      async pay(id) { t.payCalls.push(id); throw new Error('timeout'); },
      async requery() { return answer; },
    });
    const op = await t.engine.execute('b2', 'BILL', {});
    assert.equal(op.state, 'CALLED');
    await t.engine.sweep();
    assert.equal((await t.store.get('b2'))!.state, 'CALLED');
    answer = 'DELIVERED';
    await t.engine.sweep();
    assert.equal((await t.store.get('b2'))!.state, 'DELIVERED');
    assert.equal(t.payCalls.length, 1);
    assert.equal(t.refunds.length, 0);
  });

  it('refunds exactly once when the provider confirms failure', async () => {
    const t = setup({}, { async pay() { return 'FAILED'; } });
    const op = await t.engine.execute('b3', 'BILL', {});
    assert.equal(op.state, 'FAILED');
    await t.engine.advance(op);
    await t.engine.sweep();
    assert.deepEqual(t.refunds, ['b3']);
  });

  it('the request id is stable across retries', async () => {
    const ids: string[] = [];
    const t = setup({}, {
      async pay(id) { ids.push(id); throw new Error('timeout'); },
      async requery(id) { ids.push(id); return 'PENDING'; },
    });
    await t.engine.execute('b4', 'BILL', {});
    await t.engine.sweep();
    assert.equal(new Set(ids).size, 1);
  });
});

describe('follow ups', () => {
  it('runs the bill after the payment confirms, and refunds on chain if the bill fails, each step once', async () => {
    const credits: string[] = [];
    const t = setup({}, { async pay() { return 'FAILED'; } });
    const engine = createEngine({
      store: t.store,
      chain: {
        async sendSompi(_f, _t, _a, hooks) {
          const txid = 'tx' + (t.sends.length + 1);
          await hooks.onBeforeSubmit({ txid, inputs: [] });
          t.sends.push(txid);
          return { txid, txids: [txid] };
        },
        async checkPayment() { return 'PAID'; },
        async checkInputs() { return 'ALL_UNSPENT'; },
      },
      provider: { async pay() { return 'FAILED'; }, async requery() { return 'FAILED'; } },
      credit: async (_u, _s, ref) => { credits.push(ref); },
    });
    const refundLeg = { key: 'r1:refund', kind: 'PAYOUT' as const, params: { fromWallet: 'operator', fromAddress: 'kaspa:qqop', toAddress: 'kaspa:qqu', amountSompi: '500000000',
      next: { CONFIRMED: { kind: 'CREDIT' as const, key: 'credit:r1', userId: 'u1', sompi: '500000000' } } } };
    const billLeg = { key: 'r1:bill', kind: 'BILL' as const, params: { next: { FAILED: refundLeg } } };
    await engine.execute('r1:pay', 'PAYOUT', { ...params, next: { CONFIRMED: billLeg } });
    await engine.sweep();
    await engine.sweep();
    assert.equal((await t.store.get('r1:pay'))!.state, 'CONFIRMED');
    assert.equal((await t.store.get('r1:bill'))!.state, 'FAILED');
    assert.equal((await t.store.get('r1:refund'))!.state, 'CONFIRMED');
    assert.deepEqual(credits, ['credit:r1']);
    assert.equal(t.sends.length, 2, 'one payment in, one refund out');
  });
});
