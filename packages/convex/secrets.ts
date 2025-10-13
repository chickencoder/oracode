/**
 * Internal actions for the secrets table
 * These are low-level operations used by other modules
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { encryptSecret, decryptSecret } from "./lib/cryptoBrowser";

/**
 * Create a new encrypted secret
 * Returns the ID of the created secret
 */
export const create = internalAction({
  args: {
    plaintextValue: v.string(),
    createdBy: v.string(),
  },
  returns: v.id("secrets"),
  handler: async (ctx, args): Promise<Id<"secrets">> => {
    const encrypted = await encryptSecret(args.plaintextValue);

    const secretId: Id<"secrets"> = await ctx.runMutation(internal.lib.secretsHelpers.insertSecret, {
      encryptedValue: encrypted.encryptedValue,
      encryptionMetadata: encrypted.encryptionMetadata,
      createdBy: args.createdBy,
    });

    return secretId;
  },
});

/**
 * Update an existing secret with a new encrypted value
 */
export const update = internalAction({
  args: {
    secretId: v.id("secrets"),
    plaintextValue: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const encrypted = await encryptSecret(args.plaintextValue);

    await ctx.runMutation(internal.lib.secretsHelpers.updateSecret, {
      secretId: args.secretId,
      encryptedValue: encrypted.encryptedValue,
      encryptionMetadata: encrypted.encryptionMetadata,
    });

    return null;
  },
});

/**
 * Delete a secret
 */
export const remove = internalAction({
  args: {
    secretId: v.id("secrets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.lib.secretsHelpers.deleteSecret, {
      secretId: args.secretId,
    });
    return null;
  },
});

/**
 * Decrypt a secret value (only use in actions or server-side contexts)
 * This should be used sparingly and only when absolutely necessary
 */
export const decrypt = internalAction({
  args: {
    secretId: v.id("secrets"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const secret = await ctx.runQuery(internal.lib.secretsHelpers.getSecret, {
      secretId: args.secretId,
    });

    if (!secret) {
      return null;
    }

    const decrypted = await decryptSecret({
      encryptedValue: secret.encryptedValue,
      encryptionMetadata: secret.encryptionMetadata,
    });

    return decrypted;
  },
});

/**
 * Batch decrypt multiple secrets
 * Returns a map of secretId -> decrypted value
 */
export const batchDecrypt = internalAction({
  args: {
    secretIds: v.array(v.id("secrets")),
  },
  returns: v.any(), // Dynamic map of secretId -> decrypted value (Record<string, string>)
  handler: async (ctx, args) => {
    const result: Record<string, string> = {};

    for (const secretId of args.secretIds) {
      const secret = await ctx.runQuery(internal.lib.secretsHelpers.getSecret, {
        secretId,
      });

      if (secret) {
        const decrypted = await decryptSecret({
          encryptedValue: secret.encryptedValue,
          encryptionMetadata: secret.encryptionMetadata,
        });
        result[secretId] = decrypted;
      }
    }

    return result;
  },
});
