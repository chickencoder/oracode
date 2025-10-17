import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Shared branch return type validator
const branchReturnType = v.object({
  _id: v.id("branches"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  branchName: v.string(),
  agentSessionId: v.optional(v.string()),
  createdAt: v.number(),
  permissionMode: v.optional(
    v.union(
      v.literal("default"),
      v.literal("acceptEdits"),
      v.literal("bypassPermissions"),
    ),
  ),
  sandboxId: v.optional(v.string()),
  sandboxStatus: v.optional(
    v.union(
      v.literal("provisioning"),
      v.literal("starting"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("archived"),
      v.literal("error"),
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
  devServer: v.optional(
    v.object({
      sessionId: v.string(),
      commandId: v.string(),
    }),
  ),
  worker: v.optional(
    v.object({
      sessionId: v.string(),
      commandId: v.string(),
    }),
  ),
});

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
      permissionMode: "bypassPermissions", // Default to bypass permissions
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

// Get branch by org slug, project slug, and branch name (authenticated)
export const getBranchByOrgProjectAndBranchName = query({
  args: {
    orgSlug: v.string(),
    projectSlug: v.string(),
    branchName: v.string(),
  },
  returns: v.union(branchReturnType, v.null()),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const userOrgId = identity.orgId;

    // Find the organization by slug
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      return null;
    }

    // Verify user belongs to this org
    if (org.orgId !== userOrgId) {
      throw new Error("Not authorized to access this organization");
    }

    // Find the project by org and slug
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("orgId", org.orgId).eq("slug", args.projectSlug),
      )
      .first();

    if (!project) {
      return null;
    }

    // Find the branch by project and branch name
    const branch = await ctx.db
      .query("branches")
      .withIndex("by_project_and_branch_name", (q) =>
        q.eq("projectId", project._id).eq("branchName", args.branchName),
      )
      .first();

    return branch || null;
  },
});

export const getBranchById = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.union(branchReturnType, v.null()),
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
  returns: v.array(branchReturnType),
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

// Mutation to clear loading stage and mark sandbox as running
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
      sandboxStatus: "running",
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
      devServer: {
        sessionId: args.devSessionId,
        commandId: args.devCommandId,
      },
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
      worker: {
        sessionId: args.workerSessionId,
        commandId: args.workerCommandId,
      },
    });
    return null;
  },
});

// Mutation to update sandbox to "running" status
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
      sandboxStatus: "running",
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
    if (branch.sandboxStatus === "provisioning") {
      throw new Error(
        "A sandbox is already being created for this branch. Please wait.",
      );
    }

    await ctx.db.patch(args.branchId, {
      sandboxStatus: "provisioning",
      sandboxError: undefined,
      sandboxLoadingStage: "provisioning",
    });

    return null;
  },
});

// Mutation to update sandbox status (running/stopped/archived)
export const updateBranchSandboxState = mutation({
  args: {
    branchId: v.id("branches"),
    state: v.union(
      v.literal("running"),
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
      sandboxStatus: args.state,
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

// Public query to get branch by ID without auth (for proxy service)
// Note: This is intentionally public to allow the proxy service to access it
export const getBranchByIdPublic = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.union(branchReturnType, v.null()),
  handler: async (ctx, args) => {
    // No auth check - this is intentionally public for the proxy service
    const branch = await ctx.db.get(args.branchId);
    return branch || null;
  },
});

// Public query to get branch by org slug, project slug, and branch name (for preview proxy)
export const getBranchByOrgSlugProjectSlugAndBranchName = query({
  args: {
    orgSlug: v.string(),
    projectSlug: v.string(),
    branchName: v.string(),
  },
  returns: v.union(branchReturnType, v.null()),
  handler: async (ctx, args) => {
    // No auth check - this is intentionally public for the proxy service

    // First, find the organization by slug
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .first();

    if (!org) {
      return null;
    }

    // Find the project by org and slug
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("orgId", org.orgId).eq("slug", args.projectSlug),
      )
      .first();

    if (!project) {
      return null;
    }

    // Find the branch by project and branch name
    const branch = await ctx.db
      .query("branches")
      .withIndex("by_project_and_branch_name", (q) =>
        q.eq("projectId", project._id).eq("branchName", args.branchName),
      )
      .first();

    return branch || null;
  },
});

// Get branch by project and branch name
export const getBranchByProjectAndName = query({
  args: {
    projectId: v.id("projects"),
    branchName: v.string(),
  },
  returns: v.union(branchReturnType, v.null()),
  handler: async (ctx, args) => {
    // Find branch by project and name
    const branch = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("branchName"), args.branchName))
      .first();

    return branch || null;
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

    // Delete sandbox if it exists (fire and forget - don't block on this)
    if (branch.sandboxId) {
      ctx.scheduler.runAfter(0, internal.sandboxActions.deleteSandbox, {
        sandboxId: branch.sandboxId,
      });
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
