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
      sandboxState: v.optional(
        v.union(
          v.literal("started"),
          v.literal("stopped"),
          v.literal("archived"),
        ),
      ),
      sandboxDomain: v.optional(v.string()),
      sandboxPreviewToken: v.optional(v.string()),
      sandboxError: v.optional(v.string()),
      sandboxLoadingStage: v.optional(
        v.union(
          v.literal("provisioning"),
          v.literal("installing"),
          v.literal("starting"),
        ),
      ),
      // Sandbox session fields
      devSessionId: v.optional(v.string()),
      devCommandId: v.optional(v.string()),
      workerSessionId: v.optional(v.string()),
      workerCommandId: v.optional(v.string()),
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
      // Sandbox fields
      sandboxId: v.optional(v.string()),
      sandboxStatus: v.optional(
        v.union(v.literal("creating"), v.literal("ready"), v.literal("error")),
      ),
      sandboxState: v.optional(
        v.union(
          v.literal("started"),
          v.literal("stopped"),
          v.literal("archived"),
        ),
      ),
      sandboxDomain: v.optional(v.string()),
      sandboxPreviewToken: v.optional(v.string()),
      sandboxError: v.optional(v.string()),
      sandboxLoadingStage: v.optional(
        v.union(
          v.literal("provisioning"),
          v.literal("installing"),
          v.literal("starting"),
        ),
      ),
      // Sandbox session fields
      devSessionId: v.optional(v.string()),
      devCommandId: v.optional(v.string()),
      workerSessionId: v.optional(v.string()),
      workerCommandId: v.optional(v.string()),
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

    return await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
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
    previewToken: v.optional(v.string()),
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
      sandboxPreviewToken: args.previewToken,
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

// Mutation to store dev server Daytona session
export const updateSessionDevServerSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    devSessionId: v.string(),
    devCommandId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      devSessionId: args.devSessionId,
      devCommandId: args.devCommandId,
    });
    return null;
  },
});

// Mutation to store worker Daytona session
export const updateSessionWorkerSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    workerSessionId: v.string(),
    workerCommandId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      workerSessionId: args.workerSessionId,
      workerCommandId: args.workerCommandId,
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
    previewToken: v.optional(v.string()),
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
      sandboxPreviewToken: args.previewToken,
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

    await ctx.db.patch(args.sessionId, {
      sandboxStatus: "creating",
      sandboxError: undefined,
      sandboxLoadingStage: "provisioning",
    });

    return null;
  },
});

// Mutation to update sandbox state (started/stopped/archived)
export const updateSessionSandboxState = mutation({
  args: {
    sessionId: v.id("sessions"),
    state: v.union(
      v.literal("started"),
      v.literal("stopped"),
      v.literal("archived"),
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
      sandboxState: args.state,
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
