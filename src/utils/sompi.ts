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


/** Parses a non negative integer string (as stored in MongoDB) into a BigInt. Throws on anything else. */
export function parseSompiString(value: unknown): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error('Invalid sompi amount.');
    return value;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid sompi amount.');
  return BigInt(value);
}

/** Exact KAS text for a sompi amount, for example 150000000n gives "1.5" and 0n gives "0". */
export function sompiToKasString(sompi: bigint): string {
  const negative = sompi < 0n;
  const abs = negative ? -sompi : sompi;
  const whole = abs / SOMPI_PER_KAS;
  const fraction = (abs % SOMPI_PER_KAS).toString().padStart(8, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? '.' + fraction : ''}`;
}

/** KAS text cut (not rounded) to a fixed number of decimals, for messages shown to people. */
export function formatKas(sompi: bigint, decimals = 4): string {
  const negative = sompi < 0n;
  const abs = negative ? -sompi : sompi;
  const whole = abs / SOMPI_PER_KAS;
  const fraction = (abs % SOMPI_PER_KAS).toString().padStart(8, '0').slice(0, decimals);
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? '.' + fraction : ''}`;
}

/** Approximate KAS as a JS number. For display and legacy fields only, never for money decisions. */
export function sompiToKasNumber(sompi: bigint): number {
  return Number(sompi) / 100_000_000;
}
