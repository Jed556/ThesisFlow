/**
 * Client-side encryption utilities for secure data transmission
 * Uses Web Crypto API for AES-GCM encryption
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Derives a CryptoKey from a secret string using PBKDF2
 * @param secret - The shared secret string
 * @param salt - Salt for key derivation (should be consistent between client/server)
 */
async function deriveKey(secret: string, salt: string = 'thesisflow-salt'): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a plaintext string using AES-GCM
 * @param plaintext - The text to encrypt
 * @param secret - The shared secret for encryption
 * @returns Base64-encoded string containing IV + ciphertext
 */
export async function encryptPassword(plaintext: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await deriveKey(secret);

    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoder.encode(plaintext)
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an encrypted password string
 * @param encrypted - Base64-encoded IV + ciphertext
 * @param secret - The shared secret for decryption
 * @returns The original plaintext password
 */
export async function decryptPassword(encrypted: string, secret: string): Promise<string> {
    const decoder = new TextDecoder();
    const key = await deriveKey(secret);

    // Decode base64 and extract IV + ciphertext
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        ciphertext
    );

    return decoder.decode(plaintext);
}
