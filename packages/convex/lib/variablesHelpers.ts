/**
 * Internal helper functions for project environment variables
 * These are regular Convex functions (not Node.js actions)
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

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
