import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { checkProjectPermission } from "./auth";

export const createSession = mutation({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    sandboxId: v.id("sandboxes"),
  },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["create"]);

    // Verify project belongs to org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Project not found in organization");
    }

    // Verify sandbox belongs to project
    const sandbox = await ctx.db.get(args.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Sandbox not found in project");
    }

    // Create session
    const sessionId = await ctx.db.insert("sessions", {
      sandboxId: args.sandboxId,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

export const updateSessionWithAgentId = mutation({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    agentSessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["update"]);

    // Verify project belongs to org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Project not found in organization");
    }

    // Verify session chain: session -> sandbox -> project
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    // Update session
    await ctx.db.patch(args.sessionId, {
      agentSessionId: args.agentSessionId,
    });

    return null;
  },
});

export const getSessionById = query({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      agentSessionId: v.optional(v.string()),
      sandboxId: v.id("sandboxes"),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["read"]);

    // Verify project belongs to org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Project not found in organization");
    }

    // Get session and verify chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    return session;
  },
});

export const getLatestSessionBySandbox = query({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    sandboxId: v.id("sandboxes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      agentSessionId: v.optional(v.string()),
      sandboxId: v.id("sandboxes"),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["read"]);

    // Verify project belongs to org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Project not found in organization");
    }

    // Verify sandbox belongs to project
    const sandbox = await ctx.db.get(args.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Sandbox not found in project");
    }

    // Get latest session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .order("desc")
      .first();

    return session;
  },
});

export const getMessagesBySessionId = query({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
    }),
  ),
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["read"]);

    // Verify project belongs to org
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== args.orgId) {
      throw new Error("Project not found in organization");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    // Get messages
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
