import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorSeed } from '../utils/operator';
import { encryptMnemonic } from '../utils/crypto.utils';

const KEYS = ['OPERATOR_WALLET_MNEMONIC', 'OPERATOR_MNEMONIC', 'OPERATOR_ENCRYPTED_MNEMONIC', 'ENCRYPTION_KEY'];
const PHRASE = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
let saved: Record<string, string | undefined> = {};

describe('getOperatorSeed', () => {
  beforeEach(() => {
    saved = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env.ENCRYPTION_KEY = 'unit-test-encryption-key-0123456789';
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('reads the preferred OPERATOR_WALLET_MNEMONIC', () => {
    process.env.OPERATOR_WALLET_MNEMONIC = PHRASE;
    assert.equal(getOperatorSeed(), PHRASE);
  });

  it('falls back to the legacy OPERATOR_MNEMONIC name', () => {
    process.env.OPERATOR_MNEMONIC = PHRASE;
    assert.equal(getOperatorSeed(), PHRASE);
  });

  it('decrypts an encrypted value placed in either variable', () => {
    const cipher = encryptMnemonic(PHRASE, process.env.ENCRYPTION_KEY!);
    process.env.OPERATOR_WALLET_MNEMONIC = cipher;
    assert.equal(getOperatorSeed(), PHRASE);
    delete process.env.OPERATOR_WALLET_MNEMONIC;
    process.env.OPERATOR_ENCRYPTED_MNEMONIC = cipher;
    assert.equal(getOperatorSeed(), PHRASE);
  });

  it('throws a clear error when nothing is configured', () => {
    assert.throws(() => getOperatorSeed(), /Operator wallet seed is not configured/);
  });
});
