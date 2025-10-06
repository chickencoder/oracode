import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createSession = mutation({
  args: {
    projectId: v.id("projects"),
    sandboxId: v.id("sandboxes"),
  },
  returns: v.id("sessions"),
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
    projectId: v.id("projects"),
    sessionId: v.id("sessions"),
    agentSessionId: v.string(),
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Get session and verify chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox) {
      throw new Error("Session sandbox not found");
    }

    const project = await ctx.db.get(sandbox.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: Not your project");
    }

    return session;
  },
});

export const getLatestSessionBySandbox = query({
  args: {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox) {
      throw new Error("Session sandbox not found");
    }

    const project = await ctx.db.get(sandbox.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: Not your project");
    }

    // Get messages
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
