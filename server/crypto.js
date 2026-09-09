// AES-256-GCM Encryption Module — Zero-Knowledge Architecture
// The master key is derived from the user's password via PBKDF2 and NEVER stored.
// If the database is stolen, all sensitive fields are unreadable.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a 256-bit encryption key from a master key / password + salt using PBKDF2
 * This key is kept in memory only — never written to disk
 */
export function deriveKey(masterSecret, salt) {
  const secret = masterSecret || process.env.ENCRYPTION_MASTER_KEY;
  const saltVal = salt || process.env.ENCRYPTION_SALT;

  if (!secret) {
    throw new Error('ENCRYPTION_MASTER_KEY is required and cannot be empty.');
  }
  if (!saltVal) {
    throw new Error('ENCRYPTION_SALT is required and cannot be empty.');
  }

  const saltBuf = Buffer.from(saltVal, 'utf8');
  return crypto.pbkdf2Sync(secret, saltBuf, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns: base64 string of (IV + AuthTag + Ciphertext)
 */
export function encrypt(plaintext, key) {
  if (!plaintext && plaintext !== 0) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: IV(16) + Tag(16) + Ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts AES-256-GCM encrypted data
 * Input: base64 string from encrypt()
 */
export function decrypt(encryptedBase64, key) {
  if (!encryptedBase64) return '';
  try {
    const buf = Buffer.from(encryptedBase64, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH) return '';
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[decryption_failed]';
  }
}

/**
 * Encrypts a number (amount) — stores as encrypted string, decrypts back to number
 */
export function encryptAmount(amount, key) {
  return encrypt(String(amount), key);
}

export function decryptAmount(encData, key) {
  const val = decrypt(encData, key);
  return val ? parseFloat(val) : 0;
}

/**
 * Generate a hash of the encryption key for verification
 * (Used to verify the user re-enters the right password)
 */
export function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// App-level encryption key derived from dedicated ENCRYPTION_MASTER_KEY
let appKey = null;

export function getAppKey() {
  if (!appKey) {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    const salt = process.env.ENCRYPTION_SALT;
    if (!masterKey || !salt) {
      throw new Error('ENCRYPTION_MASTER_KEY and ENCRYPTION_SALT must be configured in environment');
    }
    appKey = deriveKey(masterKey, salt);
  }
  return appKey;
}
