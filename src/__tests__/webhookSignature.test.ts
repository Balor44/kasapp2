import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyPaystackSignature } from '../utils/webhookSignature';

const SECRET = 'sk_test_unit_test_secret';
const sign = (body: Buffer | string) => crypto.createHmac('sha512', SECRET).update(body).digest('hex');

describe('verifyPaystackSignature', () => {
  const raw = Buffer.from('{"event": "charge.success", "data": {"amount": 300000, "reference": "R1"}}');

  it('accepts a correct signature over the raw body', () => {
    assert.equal(verifyPaystackSignature(raw, sign(raw), SECRET), true);
  });

  it('accepts an upper case hex signature', () => {
    assert.equal(verifyPaystackSignature(raw, sign(raw).toUpperCase(), SECRET), true);
  });

  it('rejects a wrong secret, wrong body or missing parts', () => {
    assert.equal(verifyPaystackSignature(raw, sign(raw), 'another_secret'), false);
    assert.equal(verifyPaystackSignature(Buffer.from('{"event":"other"}'), sign(raw), SECRET), false);
    assert.equal(verifyPaystackSignature(raw, undefined, SECRET), false);
    assert.equal(verifyPaystackSignature(undefined, sign(raw), SECRET), false);
    assert.equal(verifyPaystackSignature(Buffer.alloc(0), sign(raw), SECRET), false);
    assert.equal(verifyPaystackSignature(raw, sign(raw), ''), false);
    assert.equal(verifyPaystackSignature(raw, 'abc', SECRET), false);
  });

  it('shows why the raw body is required: re-serialised JSON gives different bytes', () => {
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));
    assert.notEqual(reserialised.toString(), raw.toString());
    assert.equal(verifyPaystackSignature(reserialised, sign(raw), SECRET), false);
  });
});
