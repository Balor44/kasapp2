import crypto from 'crypto';


// Excludes visually confusing characters: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';


/**
 * Generates a random voucher code in the format KASP-XXXX-XXXX-XXXX-XXXX
 * Uses cryptographically secure randomness.
 */
export function generateVoucherCode(): string {
  const segments: string[] = [];
  
  // Generate 4 segments of 4 characters each
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      const randomIndex = crypto.randomInt(0, ALPHABET.length);
      segment += ALPHABET[randomIndex];
    }
    segments.push(segment);
  }
  
  // Don't forget the closing backtick!
  return `KASP-${segments.join('-')}`; 
}


/**
 * Reconstructs a canonical code from whatever a user actually typed.
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