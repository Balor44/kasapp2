import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMerchant } from '../utils/merchantKeys';

describe('merchant keys', () => {
  const env: any = { MERCHANT_API_KEYS: 'shopA:keyAAAAAAAA, shopB:keyBBBBBBBB', MERCHANT_API_KEY: 'legacyKEY123' };
  it('identifies the merchant by key', () => {
    assert.equal(resolveMerchant('keyAAAAAAAA', env), 'shopA');
    assert.equal(resolveMerchant('keyBBBBBBBB', env), 'shopB');
    assert.equal(resolveMerchant('legacyKEY123', env), 'default');
  });
  it('rejects unknown, empty and near miss keys', () => {
    assert.equal(resolveMerchant('nope', env), null);
    assert.equal(resolveMerchant('', env), null);
    assert.equal(resolveMerchant(undefined, env), null);
    assert.equal(resolveMerchant('keyAAAAAAAB', env), null);
  });
});
