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

/**
 * Reconstructs a canonical XXXX-XXXX-XXXX code from whatever a user actually typed.
 * Strips anything that isn't a letter or digit — handles missing hyphens, stray
 * spaces, and mobile keyboards that autocorrect "-" into an en dash or similar —
 * then re-groups and re-hyphenates to match the stored format exactly.
 */
export function normalizeVoucherCode(input: string): string {
  const cleaned = input.trim().toUpperCase();
  // If it already starts with KASP-, return it cleaned of markdown
  if (cleaned.startsWith('KASP-')) {
    return cleaned.replace(/[*_~]/g, '');
  }
  // If someone typed it without KASP-, prepend it
  return `KASP-${cleaned.replace(/[*_~]/g, '')}`;
}

