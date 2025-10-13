import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createBranch = mutation({
  args: {
    projectId: v.id("projects"),
    branchName: v.string(),
  },
  returns: v.id("branches"),
  handler: async (ctx, args) => {
    const branchId = await ctx.db.insert("branches", {
      projectId: args.projectId,
      branchName: args.branchName,
      createdAt: Date.now(),
    });

    return branchId;
  },
});

export const updateBranchWithAgentId = mutation({
  args: {
    branchId: v.id("branches"),
    agentSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.branchId, {
      agentSessionId: args.agentSessionId,
    });
  },
});

export const getBranchById = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.union(
    v.object({
      _id: v.id("branches"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      branchName: v.string(),
      agentSessionId: v.optional(v.string()),
      createdAt: v.number(),
      // Sandbox fields
      sandboxId: v.optional(v.string()),
      sandboxVolumeId: v.optional(v.string()),
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

    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      return null;
    }

    // Verify branch belongs to user's org
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    return branch;
  },
});

// Get all branches for a project
export const getBranchesByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("branches"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      branchName: v.string(),
      agentSessionId: v.optional(v.string()),
      createdAt: v.number(),
      // Sandbox fields
      sandboxId: v.optional(v.string()),
      sandboxVolumeId: v.optional(v.string()),
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
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const getMessagesByBranchId = query({
  args: {
    branchId: v.id("branches"),
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
      branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_org_and_branch", (q) =>
        q.eq("orgId", orgId).eq("branchId", args.branchId),
      )
      .order("asc")
      .collect();
  },
});

// Mutation to update sandbox ID (without marking ready)
export const updateBranchSandbox = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxId: args.sandboxId,
    });

    return null;
  },
});

// Mutation to update sandbox and volume IDs
export const updateBranchSandboxAndVolume = mutation({
  args: {
    branchId: v.id("branches"),
    sandboxId: v.string(),
    volumeId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxId: args.sandboxId,
      sandboxVolumeId: args.volumeId,
    });

    return null;
  },
});

// Mutation to update sandbox domain
export const updateBranchSandboxDomain = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxDomain: args.domain,
      sandboxPreviewToken: args.previewToken,
    });

    return null;
  },
});

// Mutation to clear loading stage and mark sandbox as ready
export const clearBranchSandboxLoadingStage = mutation({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxStatus: "ready",
      sandboxLoadingStage: undefined,
    });

    return null;
  },
});

// Mutation to store dev server Daytona session
export const updateBranchDevServerSession = mutation({
  args: {
    branchId: v.id("branches"),
    devSessionId: v.string(),
    devCommandId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.branchId, {
      devSessionId: args.devSessionId,
      devCommandId: args.devCommandId,
    });
    return null;
  },
});

// Mutation to store worker Daytona session
export const updateBranchWorkerSession = mutation({
  args: {
    branchId: v.id("branches"),
    workerSessionId: v.string(),
    workerCommandId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.branchId, {
      workerSessionId: args.workerSessionId,
      workerCommandId: args.workerCommandId,
    });
    return null;
  },
});

// Mutation to update sandbox to "ready" status
export const updateBranchSandboxReady = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
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
export const updateBranchSandboxStage = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxLoadingStage: args.stage,
    });

    return null;
  },
});

// Mutation to initialize sandbox creation
export const initBranchSandbox = mutation({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    // Check if sandbox is already being created
    if (branch.sandboxStatus === "creating") {
      throw new Error(
        "A sandbox is already being created for this branch. Please wait.",
      );
    }

    await ctx.db.patch(args.branchId, {
      sandboxStatus: "creating",
      sandboxError: undefined,
      sandboxLoadingStage: "provisioning",
    });

    return null;
  },
});

// Mutation to update sandbox state (started/stopped/archived)
export const updateBranchSandboxState = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxState: args.state,
    });

    return null;
  },
});

// Mutation to update sandbox to "error" status
export const updateBranchSandboxError = mutation({
  args: {
    branchId: v.id("branches"),
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

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this branch");
    }

    await ctx.db.patch(args.branchId, {
      sandboxStatus: "error",
      sandboxError: args.error,
    });

    return null;
  },
});

// Mutation to delete a branch and its messages
export const deleteBranch = mutation({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify branch belongs to user's org
    const branch = await ctx.db.get(args.branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }
    const project = await ctx.db.get(branch.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to delete this branch");
    }

    // Delete all messages for this branch
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_org_and_branch", (q) =>
        q.eq("orgId", orgId).eq("branchId", args.branchId),
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the branch
    await ctx.db.delete(args.branchId);

    return null;
  },
});
