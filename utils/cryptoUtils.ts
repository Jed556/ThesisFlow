/**
 * Server-side encryption utilities for secure data transmission
 * Uses Node.js crypto module for AES-GCM decryption
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits (appended by Web Crypto API)

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
 * Web Crypto API AES-GCM output format: IV (12 bytes) + ciphertext + authTag (16 bytes)
 * The auth tag is appended to the ciphertext by Web Crypto API
 * @param encrypted - Base64-encoded IV + ciphertext (with auth tag appended)
 * @param secret - The shared secret for decryption
 * @returns The original plaintext password
 */
export function decryptPassword(encrypted: string, secret: string): string {
    const key = deriveKey(secret);

    // Decode base64 and extract components
    const combined = Buffer.from(encrypted, 'base64');

    // Validate minimum length: IV (12) + auth tag (16) + at least 1 byte ciphertext
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        throw new Error(`Invalid encrypted data length: ${combined.length}`);
    }

    // Extract IV (first 12 bytes)
    const iv = combined.subarray(0, IV_LENGTH);

    // The remaining data is ciphertext + authTag (Web Crypto API appends auth tag)
    const encryptedData = combined.subarray(IV_LENGTH);

    // Auth tag is the last 16 bytes of the encrypted data
    const authTag = encryptedData.subarray(encryptedData.length - AUTH_TAG_LENGTH);

    // Ciphertext is everything except the auth tag
    const ciphertext = encryptedData.subarray(0, encryptedData.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}
