import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Permission mode for Claude Agent SDK
const permissionModeValidator = v.union(
  v.literal("default"),
  v.literal("acceptEdits"),
  v.literal("bypassPermissions"),
);

// Permission status
const permissionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied"),
);

/**
 * Get the permission mode for a branch
 */
export const getPermissionMode = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.union(
    v.literal("default"),
    v.literal("acceptEdits"),
    v.literal("bypassPermissions"),
  ),
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    return branch.permissionMode || "default";
  },
});

/**
 * Set the permission mode for a branch
 */
export const setPermissionMode = mutation({
  args: {
    branchId: v.id("branches"),
    mode: permissionModeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }

    await ctx.db.patch(args.branchId, {
      permissionMode: args.mode,
    });
  },
});

/**
 * Create a new permission request
 */
export const createPermissionRequest = mutation({
  args: {
    id: v.string(), // UUID
    branchId: v.id("branches"),
    toolName: v.string(),
    toolInput: v.any(),
    orgId: v.string(),
    userId: v.string(),
  },
  returns: v.id("permissions"),
  handler: async (ctx, args) => {
    const permissionId = await ctx.db.insert("permissions", {
      id: args.id,
      branchId: args.branchId,
      toolName: args.toolName,
      toolInput: args.toolInput,
      status: "pending",
      requestedAt: Date.now(),
      orgId: args.orgId,
      userId: args.userId,
    });

    return permissionId;
  },
});

/**
 * Get all pending permissions for a branch
 */
export const getPendingPermissions = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.array(
    v.object({
      _id: v.id("permissions"),
      _creationTime: v.number(),
      id: v.string(),
      branchId: v.id("branches"),
      toolName: v.string(),
      toolInput: v.any(),
      status: permissionStatusValidator,
      requestedAt: v.number(),
      resolvedAt: v.optional(v.number()),
      denialMessage: v.optional(v.string()),
      orgId: v.string(),
      userId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const permissions = await ctx.db
      .query("permissions")
      .withIndex("by_branch_and_status", (q) =>
        q.eq("branchId", args.branchId).eq("status", "pending"),
      )
      .collect();

    return permissions;
  },
});

/**
 * Get a specific permission by its UUID
 */
export const getPermissionById = query({
  args: {
    id: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("permissions"),
      _creationTime: v.number(),
      id: v.string(),
      branchId: v.id("branches"),
      toolName: v.string(),
      toolInput: v.any(),
      status: permissionStatusValidator,
      requestedAt: v.number(),
      resolvedAt: v.optional(v.number()),
      denialMessage: v.optional(v.string()),
      orgId: v.string(),
      userId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const permission = await ctx.db
      .query("permissions")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    return permission || null;
  },
});

/**
 * Resolve a permission request (approve or deny)
 */
export const resolvePermission = mutation({
  args: {
    id: v.string(),
    approved: v.boolean(),
    denialMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const permission = await ctx.db
      .query("permissions")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (!permission) {
      throw new Error("Permission request not found");
    }

    if (permission.status !== "pending") {
      throw new Error("Permission already resolved");
    }

    await ctx.db.patch(permission._id, {
      status: args.approved ? "approved" : "denied",
      resolvedAt: Date.now(),
      denialMessage: args.denialMessage,
    });
  },
});

/**
 * Clean up old resolved permissions (optional maintenance)
 */
export const cleanupOldPermissions = mutation({
  args: {
    branchId: v.id("branches"),
    olderThanMs: v.optional(v.number()), // Default 1 hour
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - (args.olderThanMs || 60 * 60 * 1000);

    const oldPermissions = await ctx.db
      .query("permissions")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "pending"),
          q.lt(q.field("resolvedAt"), cutoffTime),
        ),
      )
      .collect();

    for (const permission of oldPermissions) {
      await ctx.db.delete(permission._id);
    }

    return oldPermissions.length;
  },
});
