/**
 * Project environment variables management
 */

import { v } from "convex/values";
import { query, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Internal helper queries and mutations

export const getProject = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      orgId: v.string(),
      githubRepoId: v.number(),
      name: v.string(),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
      }),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const getByProjectAndKey = internalQuery({
  args: {
    projectId: v.id("projects"),
    key: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("variables"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      key: v.string(),
      secretId: v.id("secrets"),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("variables")
      .withIndex("by_project_and_key", (q) =>
        q.eq("projectId", args.projectId).eq("key", args.key)
      )
      .first();
  },
});

export const listInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("variables"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      key: v.string(),
      secretId: v.id("secrets"),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("variables")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = internalMutation({
  args: {
    projectId: v.id("projects"),
    key: v.string(),
    secretId: v.id("secrets"),
    createdBy: v.string(),
  },
  returns: v.id("variables"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("variables", {
      projectId: args.projectId,
      key: args.key,
      secretId: args.secretId,
      createdAt: now,
      updatedAt: now,
      createdBy: args.createdBy,
    });
  },
});

export const deleteRecord = internalMutation({
  args: {
    envVarId: v.id("variables"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.envVarId);
    return null;
  },
});

/**
 * Get all environment variables for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("variables"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      key: v.string(),
      secretId: v.id("secrets"),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify project belongs to user's org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this project");
    }

    return await ctx.db
      .query("variables")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Set an environment variable for a project
 * Creates or updates the variable
 */
export const set = action({
  args: {
    projectId: v.id("projects"),
    key: v.string(),
    value: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("User must be authenticated");
    }

    const orgId = identity.orgId as string | undefined;
    if (!orgId) {
      throw new Error("User must be authenticated with an organization");
    }
    const userId = identity.subject;

    // Verify project belongs to user's org
    const project = await ctx.runQuery(internal.variables.getProject, {
      projectId: args.projectId,
    });
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this project");
    }

    // Check if variable already exists
    const existing = await ctx.runQuery(
      internal.variables.getByProjectAndKey,
      {
        projectId: args.projectId,
        key: args.key,
      }
    );

    if (existing) {
      // Update existing variable
      await ctx.runAction(internal.secrets.update, {
        secretId: existing.secretId,
        plaintextValue: args.value,
      });
    } else {
      // Create new variable
      const secretId = await ctx.runAction(internal.secrets.create, {
        plaintextValue: args.value,
        createdBy: userId,
      });
      await ctx.runMutation(internal.variables.create, {
        projectId: args.projectId,
        key: args.key,
        secretId,
        createdBy: userId,
      });
    }

    return null;
  },
});

/**
 * Remove an environment variable from a project
 */
export const remove = action({
  args: {
    projectId: v.id("projects"),
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify project belongs to user's org
    const project = await ctx.runQuery(internal.variables.getProject, {
      projectId: args.projectId,
    });
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this project");
    }

    const envVar = await ctx.runQuery(
      internal.variables.getByProjectAndKey,
      {
        projectId: args.projectId,
        key: args.key,
      }
    );

    if (envVar) {
      // Delete the secret
      await ctx.runAction(internal.secrets.remove, {
        secretId: envVar.secretId,
      });

      // Delete the environment variable record
      await ctx.runMutation(internal.variables.deleteRecord, {
        envVarId: envVar._id,
      });
    }

    return null;
  },
});

/**
 * Get all decrypted environment variables for a project (for internal use)
 * Returns a map of key -> value
 */
export const getAllDecrypted = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.any(), // Dynamic map of string -> string (Record<string, string>)
  handler: async (ctx, args) => {
    // Note: This action doesn't check auth because it's intended for internal use
    // by sandboxActions.ts when deploying worker to sandbox
    // If exposing to clients, add auth checks

    const envVars = await ctx.runQuery(internal.variables.listInternal, {
      projectId: args.projectId,
    });

    const result: Record<string, string> = {};

    for (const envVar of envVars) {
      const decrypted = await ctx.runAction(internal.secrets.decrypt, {
        secretId: envVar.secretId,
      });
      if (decrypted) {
        result[envVar.key] = decrypted;
      }
    }

    return result;
  },
});
