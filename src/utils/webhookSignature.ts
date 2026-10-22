import crypto from 'crypto';

/**
 * Verifies a Paystack webhook signature.
 * Paystack signs the exact raw request body with HMAC SHA512 using your secret key.
 * Re-serialising parsed JSON can change the bytes, so the raw body must be used.
 */
export function verifyPaystackSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string
): boolean {
  if (!rawBody || rawBody.length === 0 || !signature || !secret) return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const given = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
  const wanted = Buffer.from(expected, 'utf8');

  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
