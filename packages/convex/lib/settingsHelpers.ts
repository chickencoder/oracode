/**
 * Internal helper functions for organization settings
 * These are regular Convex functions (not Node.js actions)
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

export const getByOrgId = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("settings"),
      _creationTime: v.number(),
      orgId: v.string(),
      anthropicApiKey: v.optional(v.id("secrets")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

export const createSettings = internalMutation({
  args: {
    orgId: v.string(),
    anthropicApiKey: v.optional(v.id("secrets")),
  },
  returns: v.id("settings"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("settings", {
      orgId: args.orgId,
      anthropicApiKey: args.anthropicApiKey,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSettings = internalMutation({
  args: {
    settingsId: v.id("settings"),
    anthropicApiKey: v.optional(v.id("secrets")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.settingsId, {
      anthropicApiKey: args.anthropicApiKey,
      updatedAt: Date.now(),
    });
    return null;
  },
});
