/**
 * Encryption utilities using Web Crypto API (browser-compatible)
 *
 * This module provides encryption/decryption using the standard Web Crypto API
 * which works in both browser and Convex runtime environments.
 *
 * Security model:
 * - Secrets are encrypted client-side before sending to Convex
 * - Master encryption key is derived from environment variable
 * - All secrets are encrypted at rest in the database
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes, recommended for AES-GCM

interface EncryptionMetadata {
  iv: string; // base64 encoded
  algorithm: string;
  version: number;
}

interface EncryptedData {
  encryptedValue: string; // base64 encoded
  encryptionMetadata: EncryptionMetadata;
}

/**
 * Get the master encryption key from environment variables
 * The key should be a base64-encoded 256-bit (32-byte) key
 */
function getMasterKeyBytes(): Uint8Array {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY environment variable is not set. " +
      "Generate one with: openssl rand -base64 32"
    );
  }

  // Decode base64 to bytes
  const binaryString = atob(key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  if (bytes.length !== 32) {
    throw new Error("Master key must be exactly 32 bytes (256 bits)");
  }

  return bytes;
}

/**
 * Import a raw key for use with Web Crypto API
 */
async function importKey(keyData: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a secret value using AES-256-GCM
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedData> {
  const masterKeyBytes = getMasterKeyBytes();

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Import the key
  const key = await importKey(masterKeyBytes);

  // Encrypt the plaintext
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    plaintextBytes
  );

  // Convert to base64 for storage
  const ciphertextArray = new Uint8Array(ciphertext);
  const ciphertextBase64 = btoa(String.fromCharCode(...ciphertextArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encryptedValue: ciphertextBase64,
    encryptionMetadata: {
      iv: ivBase64,
      algorithm: ALGORITHM,
      version: 1,
    },
  };
}

/**
 * Decrypt a secret value using AES-256-GCM
 */
export async function decryptSecret(
  encryptedData: EncryptedData
): Promise<string> {
  const masterKeyBytes = getMasterKeyBytes();

  // Validate algorithm
  if (encryptedData.encryptionMetadata.algorithm !== ALGORITHM) {
    throw new Error(
      `Unsupported encryption algorithm: ${encryptedData.encryptionMetadata.algorithm}`
    );
  }

  // Validate version
  if (encryptedData.encryptionMetadata.version !== 1) {
    throw new Error(
      `Unsupported encryption version: ${encryptedData.encryptionMetadata.version}`
    );
  }

  // Import the key
  const key = await importKey(masterKeyBytes);

  // Decode the IV and ciphertext from base64
  const ivBinaryString = atob(encryptedData.encryptionMetadata.iv);
  const iv = new Uint8Array(ivBinaryString.length);
  for (let i = 0; i < ivBinaryString.length; i++) {
    iv[i] = ivBinaryString.charCodeAt(i);
  }

  const ciphertextBinaryString = atob(encryptedData.encryptedValue);
  const ciphertext = new Uint8Array(ciphertextBinaryString.length);
  for (let i = 0; i < ciphertextBinaryString.length; i++) {
    ciphertext[i] = ciphertextBinaryString.charCodeAt(i);
  }

  // Decrypt
  const plaintextBytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext
  );

  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}
