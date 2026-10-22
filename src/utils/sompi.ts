/**
 * Exact KAS to sompi conversion using string digits and BigInt.
 * 1 KAS = 100,000,000 sompi. No floating point multiplication is used.
 */
const SOMPI_PER_KAS = 100_000_000n;

// Total KAS supply is about 28.7 billion. Anything above that is a bug or an attack.
export const MAX_SOMPI = 28_700_000_000n * SOMPI_PER_KAS;

const INVALID_AMOUNT = 'Invalid transaction amount.';
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

export function kasToSompi(amount: number | string): bigint {
  let text: string;

  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) throw new Error(INVALID_AMOUNT);
    text = amount.toFixed(8);
  } else {
    text = String(amount).trim();
    if (!PLAIN_DECIMAL.test(text)) {
      // Accept other numeric spellings (for example "1e-7") through Number, then fix to 8 decimals.
      const parsed = Number(text);
      if (text === '' || !Number.isFinite(parsed)) throw new Error(INVALID_AMOUNT);
      text = parsed.toFixed(8);
    }
  }

  if (!PLAIN_DECIMAL.test(text)) throw new Error(INVALID_AMOUNT);

  const [whole, fraction = ''] = text.split('.');
  let sompi = BigInt(whole) * SOMPI_PER_KAS + BigInt(fraction.padEnd(8, '0').slice(0, 8));

  // Round half up when more than 8 decimals were supplied as a string.
  if (fraction.length > 8 && fraction.charCodeAt(8) >= 53 /* '5' */) {
    sompi += 1n;
  }

  if (sompi <= 0n || sompi > MAX_SOMPI) throw new Error(INVALID_AMOUNT);
  return sompi;
}
