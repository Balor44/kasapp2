import crypto from 'crypto';

/**
 * Merchant keys. MERCHANT_API_KEYS="shopA:key1,shopB:key2" gives each merchant its own revocable key,
 * and the old single MERCHANT_API_KEY keeps working under the name "default".
 */
export function resolveMerchant(apiKey: string | undefined, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!apiKey) return null;
  const entries: Array<[string, string]> = [];
  for (const part of String(env.MERCHANT_API_KEYS || '').split(',')) {
    const i = part.indexOf(':');
    if (i > 0) entries.push([part.slice(0, i).trim(), part.slice(i + 1).trim()]);
  }
  if (env.MERCHANT_API_KEY) entries.push(['default', env.MERCHANT_API_KEY]);

  const given = Buffer.from(apiKey);
  let found: string | null = null;
  for (const [name, key] of entries) {
    const expected = Buffer.from(key);
    // Compare every key so timing does not reveal which one matched.
    if (expected.length === given.length && crypto.timingSafeEqual(given, expected) && !found) found = name;
  }
  return found;
}
