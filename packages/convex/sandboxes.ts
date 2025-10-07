import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new sandbox record with "creating" status
export const createSandbox = mutation({
  args: {
    sessionId: v.id("sessions"),
    timeoutDuration: v.number(), // in milliseconds
  },
  returns: v.id("sandboxes"),
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

    // Check if there's already a sandbox with "creating" status
    const existingSandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existingSandbox && existingSandbox.status === "creating") {
      throw new Error(
        "A sandbox is already being created for this session. Please wait.",
      );
    }

    const now = Date.now();

    // Create new sandbox record
    const sandboxId = await ctx.db.insert("sandboxes", {
      sessionId: args.sessionId,
      sandboxId: "", // Will be updated when Vercel sandbox is created
      status: "creating",
      domain: "", // Will be updated when sandbox is ready
      createdAt: now,
      timeoutAt: now + args.timeoutDuration,
      timeoutDuration: args.timeoutDuration,
    });

    return sandboxId;
  },
});

// Update sandbox to "ready" status with sandbox details
export const updateSandboxReady = mutation({
  args: {
    id: v.id("sandboxes"),
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

    // Get sandbox and verify ownership
    const sandbox = await ctx.db.get(args.id);
    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const session = await ctx.db.get(sandbox.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this sandbox");
    }

    await ctx.db.patch(args.id, {
      sandboxId: args.sandboxId,
      domain: args.domain,
      status: "ready",
      loadingStage: undefined,
    });

    return null;
  },
});

// Update sandbox loading stage
export const updateSandboxStage = mutation({
  args: {
    id: v.id("sandboxes"),
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

    // Get sandbox and verify ownership
    const sandbox = await ctx.db.get(args.id);
    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const session = await ctx.db.get(sandbox.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this sandbox");
    }

    await ctx.db.patch(args.id, {
      loadingStage: args.stage,
    });

    return null;
  },
});

// Update sandbox to "creating" status (for retries)
export const updateSandboxCreating = mutation({
  args: {
    id: v.id("sandboxes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Get sandbox and verify ownership
    const sandbox = await ctx.db.get(args.id);
    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const session = await ctx.db.get(sandbox.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this sandbox");
    }

    await ctx.db.patch(args.id, {
      status: "creating",
      error: undefined,
      loadingStage: "provisioning",
    });

    return null;
  },
});

// Update sandbox to "error" status
export const updateSandboxError = mutation({
  args: {
    id: v.id("sandboxes"),
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

    // Get sandbox and verify ownership
    const sandbox = await ctx.db.get(args.id);
    if (!sandbox) {
      throw new Error("Sandbox not found");
    }

    const session = await ctx.db.get(sandbox.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this sandbox");
    }

    await ctx.db.patch(args.id, {
      status: "error",
      error: args.error,
    });

    return null;
  },
});

// Get sandbox for a session (checks timeout status)
export const getSandboxBySession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sandboxes"),
      _creationTime: v.number(),
      sessionId: v.id("sessions"),
      sandboxId: v.string(),
      status: v.union(
        v.literal("creating"),
        v.literal("ready"),
        v.literal("timeout"),
        v.literal("error"),
      ),
      domain: v.string(),
      createdAt: v.number(),
      timeoutAt: v.number(),
      timeoutDuration: v.number(),
      error: v.optional(v.string()),
      loadingStage: v.optional(
        v.union(
          v.literal("provisioning"),
          v.literal("cloning"),
          v.literal("installing"),
          v.literal("starting"),
        ),
      ),
      // Computed field: is the sandbox actually timed out?
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

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    // Get sandbox for this session
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!sandbox) {
      return null;
    }

    // Check if sandbox has timed out
    const now = Date.now();
    const isTimedOut = now >= sandbox.timeoutAt;

    return {
      ...sandbox,
      isTimedOut,
    };
  },
});
