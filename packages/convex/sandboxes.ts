import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

// Action to start a sandbox for a session
export const startSandbox = action({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { sessionId: Id<"sessions"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== startSandbox action called ===");
    console.log("Session ID:", args.sessionId);

    // Step 1: Get auth and verify session ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    console.log("Authenticated user org:", identity.orgId);

    // Step 2: Check for existing sandbox
    const existingSandbox = await ctx.runQuery(
      api.sandboxes.getSandboxBySession,
      {
        sessionId: args.sessionId,
      },
    );

    console.log("Existing sandbox:", existingSandbox);

    // Step 3: Handle existing sandbox scenarios
    if (existingSandbox) {
      // If already creating, return error to prevent duplicates
      if (existingSandbox.status === "creating") {
        throw new Error(
          "A sandbox is already being created for this session. Please wait.",
        );
      }

      // If ready and not timed out, return existing
      if (existingSandbox.status === "ready" && !existingSandbox.isTimedOut) {
        console.log("Returning existing ready sandbox");
        return {
          sandboxId: existingSandbox.sandboxId,
          domain: existingSandbox.domain,
          status: "ready",
        };
      }

      console.log("Existing sandbox is timed out or errored, will create new one");
    }

    // Step 4: Create new sandbox record with "creating" status
    const timeoutDuration = 60 * 60 * 1000; // 1 hour in ms
    console.log("Creating sandbox record with timeout:", timeoutDuration);

    const sandboxRecordId = await ctx.runMutation(api.sandboxes.createSandbox, {
      sessionId: args.sessionId,
      timeoutDuration,
    });

    console.log("Created sandbox record:", sandboxRecordId);

    // Step 5: TODO - Create actual Vercel Sandbox
    console.log("TODO: Call Sandbox.create() here");
    console.log("Would create Vercel Sandbox with:");
    console.log("  - Session ID:", args.sessionId);
    console.log("  - Timeout:", timeoutDuration, "ms");

    // For now, simulate success
    const mockSandboxId = `mock-sandbox-${Date.now()}`;
    const mockDomain = `mock-domain-${Date.now()}.vercel.app`;

    console.log("Mock sandbox created:");
    console.log("  - Sandbox ID:", mockSandboxId);
    console.log("  - Domain:", mockDomain);

    // Step 6: Update sandbox record to "ready"
    await ctx.runMutation(api.sandboxes.updateSandboxReady, {
      id: sandboxRecordId,
      sandboxId: mockSandboxId,
      domain: mockDomain,
    });

    console.log("Updated sandbox record to ready status");
    console.log("=== startSandbox action complete ===");

    return {
      sandboxId: mockSandboxId,
      domain: mockDomain,
      status: "ready",
    };
  },
});
