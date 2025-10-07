import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createSession = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.id("sessions"),
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("sessions", {
      projectId: args.projectId,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

export const updateSessionWithAgentId = mutation({
  args: {
    sessionId: v.id("sessions"),
    agentSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      agentSessionId: args.agentSessionId,
    });
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
      projectId: v.id("projects"),
      agentSessionId: v.optional(v.string()),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Verify session belongs to user's org
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    return session;
  },
});

// Get all sessions for a project
export const getSessionsByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("sessions"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      agentSessionId: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
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

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return sessions;
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
      userId: v.string(),
      orgId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_org_and_session", (q) =>
        q.eq("orgId", orgId).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .collect();
  },
});