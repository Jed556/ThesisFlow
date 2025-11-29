/**
 * Server-side encryption utilities for secure data transmission
 * Uses Node.js crypto module for AES-GCM decryption
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derives a key from a secret string using PBKDF2
 * @param secret - The shared secret string
 * @param salt - Salt for key derivation (must match client-side)
 */
function deriveKey(secret: string, salt: string = 'thesisflow-salt'): Buffer {
    return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

/**
 * Decrypts an encrypted password string from the client
 * @param encrypted - Base64-encoded IV + ciphertext + authTag
 * @param secret - The shared secret for decryption
 * @returns The original plaintext password
 */
export function decryptPassword(encrypted: string, secret: string): string {
    const key = deriveKey(secret);

    // Decode base64 and extract IV + ciphertext + authTag
    const combined = Buffer.from(encrypted, 'base64');

    // AES-GCM appends auth tag to ciphertext in Web Crypto API
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}
