import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new project
export const createProject = mutation({
  args: {
    githubRepoId: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      installCommand: v.string(),
      devCommand: v.string(),
      port: v.number(),
    }),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Create the project
    const projectId = await ctx.db.insert("projects", {
      orgId,
      githubRepoId: args.githubRepoId,
      name: args.name,
      description: args.description ?? "",
      settings: args.settings,
      createdAt: Date.now(),
    });

    return projectId;
  },
});

// Get all projects for the authenticated user's organization
export const getProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      githubRepoId: v.number(),
      name: v.string(),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
      }),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      return [];
    }
    const orgId = identity.orgId;

    // Query projects for this org
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Map to return type (excluding orgId for client)
    return projects.map((project) => ({
      _id: project._id,
      githubRepoId: project.githubRepoId,
      name: project.name,
      description: project.description,
      settings: project.settings,
      createdAt: project.createdAt,
    }));
  },
});

// Update a project
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      installCommand: v.string(),
      devCommand: v.string(),
      port: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Get the project and verify ownership
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.orgId !== orgId) {
      throw new Error("Not authorized to update this project");
    }

    // Update the project
    await ctx.db.patch(args.projectId, {
      name: args.name,
      description: args.description ?? "",
      settings: args.settings,
    });

    return null;
  },
});

// Delete a project and all associated sessions
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Get the project and verify ownership
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.orgId !== orgId) {
      throw new Error("Not authorized to delete this project");
    }

    // Delete all sessions associated with this project
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const session of sessions) {
      // Delete all messages for each session
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete the session
      await ctx.db.delete(session._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);

    return null;
  },
});
