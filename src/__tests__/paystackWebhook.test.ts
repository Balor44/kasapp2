import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { freshRequire, installMocks, local, pkg } from './helpers/loader';

const SECRET = 'sk_test_webhook_unit_test';

const sign = (raw: Buffer) => crypto.createHmac('sha512', SECRET).update(raw).digest('hex');

function makeEvent(overrides: Record<string, any> = {}) {
  const body = {
    event: 'charge.success',
    data: { reference: 'KASAPP-REF-1', amount: 500000, currency: 'NGN', metadata: { user_phone: '2348012345678' } },
    ...overrides,
  };
  return { body, raw: Buffer.from(JSON.stringify(body, null, 2)) };
}

function makeReq(event: { body: any; raw: Buffer }, signature?: string | null, withRaw = true) {
  return {
    body: event.body,
    rawBody: withRaw ? event.raw : undefined,
    headers: signature === null ? {} : { 'x-paystack-signature': signature ?? sign(event.raw) },
  };
}

function makeRes() {
  const res: any = { code: undefined };
  res.sendStatus = (code: number) => {
    res.code = code;
    return res;
  };
  return res;
}

describe('Paystack webhook', () => {
  let restore: () => void;
  let store: any[];
  let schemaDefinitions: any[];
  let createFails: boolean;
  let handler: (req: any, res: any) => Promise<any>;
  let savedSecret: string | undefined;

  beforeEach(() => {
    store = [];
    schemaDefinitions = [];
    createFails = false;
    savedSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = SECRET;

    class FakeModel {
      static async findOne(query: any) {
        return store.find((doc) => doc.transactionRef === query.transactionRef) || null;
      }
      static async create(doc: any) {
        if (createFails) throw new Error('database unavailable');
        if (doc.transactionRef && store.some((d) => d.transactionRef === doc.transactionRef)) {
          const error: any = new Error('E11000 duplicate key error');
          error.code = 11000;
          error.keyPattern = { transactionRef: 1 };
          throw error;
        }
        store.push({ ...doc });
        return doc;
      }
    }
    class FakeSchema {
      constructor(definition: any) {
        schemaDefinitions.push(definition);
      }
    }

    restore = installMocks([
      pkg('mongoose', { Schema: FakeSchema, model: () => FakeModel }),
      pkg('axios', { __esModule: true, default: {} }),
      local('/utils/price', { nairaToKAS: async (naira: number) => naira / 50 }),
    ]);
    handler = freshRequire('controllers/payment.controller').PaymentController.handlePaystackWebhook;
  });

  afterEach(() => {
    restore();
    if (savedSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = savedSecret;
  });

  it('rejects an invalid signature with 401 and creates nothing', async () => {
    const res = makeRes();
    await handler(makeReq(makeEvent(), 'deadbeef'), res);
    assert.equal(res.code, 401);
    assert.equal(store.length, 0);
  });

  it('rejects a request with no signature header or no raw body', async () => {
    const noHeader = makeRes();
    await handler(makeReq(makeEvent(), null), noHeader);
    assert.equal(noHeader.code, 401);

    const noRaw = makeRes();
    await handler(makeReq(makeEvent(), undefined, false), noRaw);
    assert.equal(noRaw.code, 401);
    assert.equal(store.length, 0);
  });

  it('creates exactly one voucher for a valid charge.success and answers 200 afterwards', async () => {
    const res = makeRes();
    await handler(makeReq(makeEvent()), res);
    assert.equal(res.code, 200);
    assert.equal(store.length, 1);
    assert.equal(store[0].transactionRef, 'KASAPP-REF-1');
    assert.equal(store[0].amountNaira, 5000);
    assert.equal(store[0].amount, 100);
    assert.match(store[0].code, /^KASP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('is idempotent when Paystack redelivers the same event', async () => {
    const event = makeEvent();
    await handler(makeReq(event), makeRes());
    const second = makeRes();
    await handler(makeReq(event), second);
    assert.equal(second.code, 200);
    assert.equal(store.length, 1);
  });

  it('creates only one voucher when two deliveries arrive at the same moment', async () => {
    const event = makeEvent();
    const a = makeRes();
    const b = makeRes();
    await Promise.all([handler(makeReq(event), a), handler(makeReq(event), b)]);
    assert.equal(a.code, 200);
    assert.equal(b.code, 200);
    assert.equal(store.length, 1);
  });

  it('acknowledges and ignores other events and non NGN payments', async () => {
    const other = makeRes();
    await handler(makeReq(makeEvent({ event: 'transfer.success' })), other);
    assert.equal(other.code, 200);

    const usd = makeRes();
    await handler(
      makeReq(makeEvent({ data: { reference: 'R2', amount: 500000, currency: 'USD', metadata: {} } })),
      usd
    );
    assert.equal(usd.code, 200);
    assert.equal(store.length, 0);
  });

  it('answers 500 when processing fails, so Paystack retries', async () => {
    createFails = true;
    const res = makeRes();
    await handler(makeReq(makeEvent()), res);
    assert.equal(res.code, 500);
    assert.equal(store.length, 0);
  });

  it('declares a unique, sparse index on transactionRef', () => {
    const definition = schemaDefinitions.find((d) => d && d.transactionRef);
    assert.ok(definition, 'RechargeCard schema should have been defined');
    assert.equal(definition.transactionRef.unique, true);
    assert.equal(definition.transactionRef.sparse, true);
  });
});
