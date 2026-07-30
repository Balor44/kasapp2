import crypto from 'crypto';


/**
 * Encrypts a plaintext string (e.g. 12/24-word seed phrase) using AES-256-GCM.
 * Output format: iv:authTag:encryptedHex
 */
export function encryptMnemonic(text: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined.');
  }


  // Ensure key length is exactly 32 bytes (256 bits)
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);


  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');


  const authTag = cipher.getAuthTag().toString('hex');


  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}


/**
 * Decrypts an AES-256-GCM encrypted string back into plaintext.
 */
export function decryptMnemonic(encryptedData: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined.');
  }


  const parts = encryptedData.split(':');
  
  // Fallback for legacy unencrypted plain-text mnemonics during testing
  if (parts.length !== 3) {
    return encryptedData;
  }


  const [ivHex, authTagHex, encryptedText] = parts;


  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');


  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);


  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');


  return decrypted;
}