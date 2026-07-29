import crypto from 'crypto';

// Excludes visually confusing characters: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generates a random voucher code in the format XXXX-XXXX-XXXX (12 chars, grouped).
 * Uses crypto.randomInt for cryptographically secure randomness — voucher codes
 * are effectively bearer cash, so they must not be predictable or brute-forceable.
 */
export function generateVoucherCode(): string {
  let raw = '';
  for (let i = 0; i < 12; i++) {
    raw += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return raw.match(/.{1,4}/g)!.join('-');
}

