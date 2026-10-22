import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins } from '../utils/corsOrigins';

describe('parseAllowedOrigins', () => {
  it('returns null when unset or empty', () => {
    assert.equal(parseAllowedOrigins(undefined), null);
    assert.equal(parseAllowedOrigins(''), null);
    assert.equal(parseAllowedOrigins(' , ,'), null);
  });

  it('splits, trims and removes trailing slashes', () => {
    assert.deepEqual(parseAllowedOrigins('https://mykasapp.com/, https://www.mykasapp.com'), [
      'https://mykasapp.com',
      'https://www.mykasapp.com',
    ]);
  });
});
