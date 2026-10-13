import { decryptMnemonic } from './crypto.utils';

/**
 * Single source of truth for the operator wallet seed.
 * Accepts OPERATOR_WALLET_MNEMONIC (preferred), the legacy OPERATOR_MNEMONIC,
 * or OPERATOR_ENCRYPTED_MNEMONIC. A value containing spaces is treated as a
 * plaintext phrase; anything else is treated as an AES encrypted string.
 */
export function getOperatorSeed(): string {
  const encryptionKey = process.env.ENCRYPTION_KEY || '';
  const raw = (process.env.OPERATOR_WALLET_MNEMONIC || process.env.OPERATOR_MNEMONIC || '').trim();

  if (raw) {
    return raw.includes(' ') ? raw : decryptMnemonic(raw, encryptionKey);
  }

  const encrypted = (process.env.OPERATOR_ENCRYPTED_MNEMONIC || '').trim();
  if (encrypted) {
    return decryptMnemonic(encrypted, encryptionKey);
  }

  throw new Error('Operator wallet seed is not configured (set OPERATOR_WALLET_MNEMONIC).');
}
