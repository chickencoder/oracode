/**
 * Organization-level settings and API key management
 */

import { v } from "convex/values";
import { query, action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Get organization settings for the authenticated user's org
 */
export const get = query({
  args: {},
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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    return settings;
  },
});

/**
 * Set the Anthropic API key for the organization
 * This creates or updates the organization settings
 */
export const setAnthropicApiKey = action({
  args: {
    apiKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || !identity?.subject || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;
    const userId = identity.subject;

    // Validate API key format (basic check)
    if (!args.apiKey.startsWith("sk-ant-")) {
      throw new Error("Invalid Anthropic API key format");
    }

    // Get or create organization settings
    const existingSettings = await ctx.runQuery(internal.lib.settingsHelpers.getByOrgId, {
      orgId,
    });

    if (existingSettings) {
      // Update existing API key or create new one
      if (existingSettings.anthropicApiKey) {
        // Update the existing secret
        await ctx.runAction(internal.secrets.update, {
          secretId: existingSettings.anthropicApiKey,
          plaintextValue: args.apiKey,
        });
      } else {
        // Create new secret and link it
        const secretId = await ctx.runAction(internal.secrets.create, {
          plaintextValue: args.apiKey,
          createdBy: userId,
        });
        await ctx.runMutation(internal.lib.settingsHelpers.updateSettings, {
          settingsId: existingSettings._id,
          anthropicApiKey: secretId,
        });
      }
    } else {
      // Create new organization settings with API key
      const secretId = await ctx.runAction(internal.secrets.create, {
        plaintextValue: args.apiKey,
        createdBy: userId,
      });
      await ctx.runMutation(internal.lib.settingsHelpers.createSettings, {
        orgId,
        anthropicApiKey: secretId,
      });
    }

    return null;
  },
});

/**
 * Remove the Anthropic API key from the organization
 */
export const removeAnthropicApiKey = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    const settings = await ctx.runQuery(internal.lib.settingsHelpers.getByOrgId, {
      orgId,
    });

    if (settings?.anthropicApiKey) {
      // Delete the secret
      await ctx.runAction(internal.secrets.remove, {
        secretId: settings.anthropicApiKey,
      });

      // Remove the reference
      await ctx.runMutation(internal.lib.settingsHelpers.updateSettings, {
        settingsId: settings._id,
        anthropicApiKey: undefined,
      });
    }

    return null;
  },
});

/**
 * Get the decrypted Anthropic API key (for internal use only)
 */
export const getAnthropicApiKeyDecrypted = action({
  args: {
    orgId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    // Note: This action doesn't check auth because it's intended for internal use
    // by sandboxActions.ts and similar server-side code
    // If exposing to clients, add auth checks

    const settings = await ctx.runQuery(internal.lib.settingsHelpers.getByOrgId, {
      orgId: args.orgId,
    });

    if (!settings?.anthropicApiKey) {
      return null;
    }

    const decrypted = await ctx.runAction(internal.secrets.decrypt, {
      secretId: settings.anthropicApiKey,
    });

    return decrypted;
  },
});
