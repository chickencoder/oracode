"use node";

/**
 * Encryption utilities for secure secret storage
 *
 * This module provides both client-side (browser) and server-side (Node.js)
 * encryption/decryption using AES-256-GCM.
 *
 * Security model:
 * - Secrets are encrypted client-side before sending to Convex
 * - Master encryption key is stored in Convex environment variables
 * - Secrets are only decrypted server-side when deploying to sandboxes
 * - All secrets are encrypted at rest in the database
 */

import { webcrypto } from "node:crypto";

const ALGORITHM = "AES-256-GCM";
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
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY environment variable is not set. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
  return key;
}

/**
 * Import a raw key for use with Web Crypto API
 */
async function importKey(keyData: Uint8Array): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a secret value using AES-256-GCM
 * Server-side implementation using Node.js crypto
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedData> {
  const masterKeyBase64 = getMasterKey();
  const masterKeyBytes = Buffer.from(masterKeyBase64, "base64");

  if (masterKeyBytes.length !== 32) {
    throw new Error("Master key must be exactly 32 bytes (256 bits)");
  }

  // Generate a random IV
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Import the key
  const key = await importKey(masterKeyBytes);

  // Encrypt the plaintext
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const ciphertext = await webcrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    plaintextBytes
  );

  return {
    encryptedValue: Buffer.from(ciphertext).toString("base64"),
    encryptionMetadata: {
      iv: Buffer.from(iv).toString("base64"),
      algorithm: ALGORITHM,
      version: 1,
    },
  };
}

/**
 * Decrypt a secret value using AES-256-GCM
 * Server-side implementation using Node.js crypto
 */
export async function decryptSecret(
  encryptedData: EncryptedData
): Promise<string> {
  const masterKeyBase64 = getMasterKey();
  const masterKeyBytes = Buffer.from(masterKeyBase64, "base64");

  if (masterKeyBytes.length !== 32) {
    throw new Error("Master key must be exactly 32 bytes (256 bits)");
  }

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

  // Decode the IV and ciphertext
  const iv = Buffer.from(encryptedData.encryptionMetadata.iv, "base64");
  const ciphertext = Buffer.from(encryptedData.encryptedValue, "base64");

  // Decrypt
  const plaintextBytes = await webcrypto.subtle.decrypt(
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

/**
 * Client-side encryption utility for browser use
 * This can be called from React components
 */
export async function encryptSecretClientSide(plaintext: string, masterKeyBase64: string): Promise<EncryptedData> {
  const masterKeyBytes = Uint8Array.from(atob(masterKeyBase64), c => c.charCodeAt(0));

  if (masterKeyBytes.length !== 32) {
    throw new Error("Master key must be exactly 32 bytes (256 bits)");
  }

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    masterKeyBytes,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt"]
  );

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
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
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
