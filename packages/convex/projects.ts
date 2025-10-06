import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getProjectById = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.string(),
      fullName: v.string(),
      owner: v.string(),
      repoId: v.number(),
      description: v.optional(v.string()),
      isPrivate: v.boolean(),
      htmlUrl: v.string(),
      installCommand: v.string(),
      devCommand: v.string(),
      port: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Get project by ID
    const project = await ctx.db.get(args.projectId);

    // Verify project belongs to user
    if (!project || project.userId !== identity.tokenIdentifier) {
      return null;
    }

    return project;
  },
});

export const getUserProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      userId: v.string(),
      name: v.string(),
      fullName: v.string(),
      owner: v.string(),
      repoId: v.number(),
      description: v.optional(v.string()),
      isPrivate: v.boolean(),
      htmlUrl: v.string(),
      installCommand: v.string(),
      devCommand: v.string(),
      port: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Get all projects for this user
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect();

    return projects;
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    fullName: v.string(),
    owner: v.string(),
    repoId: v.number(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    htmlUrl: v.string(),
    installCommand: v.string(),
    devCommand: v.string(),
    port: v.string(),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Insert project with userId
    const projectId = await ctx.db.insert("projects", {
      userId: identity.tokenIdentifier,
      name: args.name,
      fullName: args.fullName,
      owner: args.owner,
      repoId: args.repoId,
      description: args.description,
      isPrivate: args.isPrivate,
      htmlUrl: args.htmlUrl,
      installCommand: args.installCommand,
      devCommand: args.devCommand,
      port: args.port,
    });

    return projectId;
  },
});
