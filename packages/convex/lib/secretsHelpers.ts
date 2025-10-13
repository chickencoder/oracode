/**
 * Internal helper functions for secrets management
 * These are regular Convex functions (not Node.js actions)
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

export const getSecret = internalQuery({
  args: {
    secretId: v.id("secrets"),
  },
  returns: v.union(
    v.object({
      _id: v.id("secrets"),
      _creationTime: v.number(),
      encryptedValue: v.string(),
      encryptionMetadata: v.object({
        iv: v.string(),
        algorithm: v.string(),
        version: v.number(),
      }),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.secretId);
  },
});

export const insertSecret = internalMutation({
  args: {
    encryptedValue: v.string(),
    encryptionMetadata: v.object({
      iv: v.string(),
      algorithm: v.string(),
      version: v.number(),
    }),
    createdBy: v.string(),
  },
  returns: v.id("secrets"),
  handler: async (ctx, args) => {
    const secretId = await ctx.db.insert("secrets", {
      encryptedValue: args.encryptedValue,
      encryptionMetadata: args.encryptionMetadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: args.createdBy,
    });

    return secretId;
  },
});

export const updateSecret = internalMutation({
  args: {
    secretId: v.id("secrets"),
    encryptedValue: v.string(),
    encryptionMetadata: v.object({
      iv: v.string(),
      algorithm: v.string(),
      version: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.secretId, {
      encryptedValue: args.encryptedValue,
      encryptionMetadata: args.encryptionMetadata,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const deleteSecret = internalMutation({
  args: {
    secretId: v.id("secrets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.secretId);
    return null;
  },
});
