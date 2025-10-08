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
      // Sandbox fields
      sandboxId: v.optional(v.string()),
      sandboxStatus: v.optional(
        v.union(v.literal("creating"), v.literal("ready"), v.literal("error")),
      ),
      sandboxDomain: v.optional(v.string()),
      sandboxCreatedAt: v.optional(v.number()),
      sandboxTimeoutAt: v.optional(v.number()),
      sandboxTimeoutDuration: v.optional(v.number()),
      sandboxError: v.optional(v.string()),
      sandboxLoadingStage: v.optional(
        v.union(
          v.literal("provisioning"),
          v.literal("cloning"),
          v.literal("installing"),
          v.literal("starting"),
        ),
      ),
      // Computed field
      isTimedOut: v.boolean(),
    }),
    v.null(),
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

    // Compute isTimedOut
    const now = Date.now();
    const isTimedOut =
      session.sandboxTimeoutAt !== undefined &&
      now >= session.sandboxTimeoutAt;

    return {
      ...session,
      isTimedOut,
    };
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
      // Sandbox fields
      sandboxId: v.optional(v.string()),
      sandboxStatus: v.optional(
        v.union(v.literal("creating"), v.literal("ready"), v.literal("error")),
      ),
      sandboxDomain: v.optional(v.string()),
      sandboxCreatedAt: v.optional(v.number()),
      sandboxTimeoutAt: v.optional(v.number()),
      sandboxTimeoutDuration: v.optional(v.number()),
      sandboxError: v.optional(v.string()),
      sandboxLoadingStage: v.optional(
        v.union(
          v.literal("provisioning"),
          v.literal("cloning"),
          v.literal("installing"),
          v.literal("starting"),
        ),
      ),
      // Computed field
      isTimedOut: v.boolean(),
    }),
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

    // Compute isTimedOut for each session
    const now = Date.now();
    return sessions.map((session) => ({
      ...session,
      isTimedOut:
        session.sandboxTimeoutAt !== undefined &&
        now >= session.sandboxTimeoutAt,
    }));
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
    }),
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
        q.eq("orgId", orgId).eq("sessionId", args.sessionId),
      )
      .order("asc")
      .collect();
  },
});

// Mutation to update sandbox ID (without marking ready)
export const updateSessionSandbox = mutation({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxId: args.sandboxId,
    });

    return null;
  },
});

// Mutation to update sandbox domain
export const updateSessionSandboxDomain = mutation({
  args: {
    sessionId: v.id("sessions"),
    domain: v.string(),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxDomain: args.domain,
    });

    return null;
  },
});

// Mutation to clear loading stage and mark sandbox as ready
export const clearSessionSandboxLoadingStage = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxStatus: "ready",
      sandboxLoadingStage: undefined,
    });

    return null;
  },
});

// Mutation to update sandbox to "ready" status
export const updateSessionSandboxReady = mutation({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
    domain: v.string(),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxId: args.sandboxId,
      sandboxDomain: args.domain,
      sandboxStatus: "ready",
      sandboxLoadingStage: undefined,
    });

    return null;
  },
});

// Mutation to update sandbox loading stage
export const updateSessionSandboxStage = mutation({
  args: {
    sessionId: v.id("sessions"),
    stage: v.union(
      v.literal("provisioning"),
      v.literal("cloning"),
      v.literal("installing"),
      v.literal("starting"),
    ),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxLoadingStage: args.stage,
    });

    return null;
  },
});

// Mutation to initialize sandbox creation
export const initSessionSandbox = mutation({
  args: {
    sessionId: v.id("sessions"),
    timeoutDuration: v.number(),
  },
  returns: v.null(),
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

    // Check if sandbox is already being created
    if (session.sandboxStatus === "creating") {
      throw new Error(
        "A sandbox is already being created for this session. Please wait.",
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.sessionId, {
      sandboxStatus: "creating",
      sandboxCreatedAt: now,
      sandboxTimeoutAt: now + args.timeoutDuration,
      sandboxTimeoutDuration: args.timeoutDuration,
      sandboxError: undefined,
      sandboxLoadingStage: "provisioning",
    });

    return null;
  },
});

// Mutation to update sandbox to "error" status
export const updateSessionSandboxError = mutation({
  args: {
    sessionId: v.id("sessions"),
    error: v.string(),
  },
  returns: v.null(),
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

    await ctx.db.patch(args.sessionId, {
      sandboxStatus: "error",
      sandboxError: args.error,
    });

    return null;
  },
});
