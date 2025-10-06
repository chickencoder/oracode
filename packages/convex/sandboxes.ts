import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getActiveSandboxByIds = query({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sandboxes"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      branchId: v.id("branches"),
      sandboxId: v.string(),
      domain: v.string(),
      status: v.union(v.literal("active"), v.literal("stopped")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Get active sandbox
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_project_and_branch", (q) =>
        q.eq("projectId", args.projectId).eq("branchId", args.branchId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return sandbox;
  },
});

export const createSandbox = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    sandboxId: v.string(),
    domain: v.string(),
  },
  returns: v.id("sandboxes"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Create sandbox
    const sandboxRecordId = await ctx.db.insert("sandboxes", {
      projectId: args.projectId,
      branchId: args.branchId,
      sandboxId: args.sandboxId,
      domain: args.domain,
      status: "active",
      createdAt: Date.now(),
    });

    return sandboxRecordId;
  },
});

export const updateSandboxStatus = mutation({
  args: {
    projectId: v.id("projects"),
    sandboxRecordId: v.id("sandboxes"),
    status: v.union(v.literal("active"), v.literal("stopped")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Verify sandbox belongs to project
    const sandbox = await ctx.db.get(args.sandboxRecordId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Sandbox not found in project");
    }

    // Update sandbox status
    await ctx.db.patch(args.sandboxRecordId, {
      status: args.status,
    });

    return null;
  },
});

export const getActiveSandbox = query({
  args: {
    sandboxId: v.id("sandboxes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sandboxes"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      branchId: v.id("branches"),
      sandboxId: v.string(),
      domain: v.string(),
      status: v.union(v.literal("active"), v.literal("stopped")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    const sandbox = await ctx.db.get(args.sandboxId);
    if (!sandbox) {
      return null;
    }

    const project = await ctx.db.get(sandbox.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: Not your project");
    }

    return sandbox;
  },
});
