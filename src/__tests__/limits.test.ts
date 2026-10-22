import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkLimits, readLimits } from '../services/limits';

describe('send limits', () => {
  const limits = readLimits({ MAX_SEND_KAS_PER_TX: '100', MAX_SEND_KAS_PER_DAY: '250' });
  it('allows within limits', () => assert.equal(checkLimits(10_000_000_000n, 0n, limits).ok, true));
  it('blocks above the per transaction limit', () => {
    const r = checkLimits(10_000_000_001n, 0n, limits);
    assert.equal(r.ok, false);
    assert.equal((r as any).reason, 'PER_TX');
  });
  it('blocks when the day total would be exceeded', () => {
    const r = checkLimits(5_000_000_000n, 21_000_000_000n, limits);
    assert.equal((r as any).reason, 'PER_DAY');
  });
  it('allows exactly the day limit', () => assert.equal(checkLimits(5_000_000_000n, 20_000_000_000n, limits).ok, true));
  it('unset or invalid means no limit', () => {
    assert.equal(checkLimits(10n ** 15n, 0n, readLimits({})).ok, true);
    assert.equal(checkLimits(10n ** 15n, 0n, readLimits({ MAX_SEND_KAS_PER_TX: 'abc' })).ok, true);
  });
});
