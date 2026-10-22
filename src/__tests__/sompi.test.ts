import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kasToSompi, MAX_SOMPI } from '../utils/sompi';

describe('kasToSompi', () => {
  it('converts whole and fractional amounts exactly', () => {
    assert.equal(kasToSompi(1), 100_000_000n);
    assert.equal(kasToSompi(0.1), 10_000_000n);
    assert.equal(kasToSompi(12.5), 1_250_000_000n);
    assert.equal(kasToSompi('0.00000001'), 1n);
  });

  it('avoids classic floating point artefacts', () => {
    // 0.29 * 1e8 is 28999999.999999996 in floating point
    assert.equal(kasToSompi(0.29), 29_000_000n);
    assert.equal(kasToSompi(1.1), 110_000_000n);
    assert.equal(kasToSompi(4.35), 435_000_000n);
  });

  it('rounds string input with more than 8 decimals half up', () => {
    assert.equal(kasToSompi('1.123456789'), 112_345_679n);
    assert.equal(kasToSompi('1.123456784'), 112_345_678n);
    assert.equal(kasToSompi('0.000000005'), 1n);
  });

  it('accepts other numeric spellings through Number', () => {
    assert.equal(kasToSompi('1e-7'), 10n);
  });

  it('rejects zero, negatives and non numbers', () => {
    for (const bad of [0, -1, -0.5, NaN, Infinity, '', 'abc', '0', '-3', '1,5']) {
      assert.throws(() => kasToSompi(bad as any), /Invalid transaction amount\./, `should reject ${String(bad)}`);
    }
  });

  it('rejects absurdly large amounts', () => {
    assert.throws(() => kasToSompi(1e22), /Invalid transaction amount\./);
    assert.throws(() => kasToSompi('29000000000'), /Invalid transaction amount\./);
    assert.equal(kasToSompi('28700000000'), MAX_SOMPI);
  });
});
