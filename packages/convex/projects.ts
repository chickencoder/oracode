import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkProjectPermission } from "./auth";

export const getProjectById = query({
  args: {
    orgId: v.string(),
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      orgId: v.string(),
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
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, args.projectId, ["read"]);

    // Get project by ID
    const project = await ctx.db.get(args.projectId);

    // Defense in depth: verify project belongs to org
    if (!project || project.orgId !== args.orgId) {
      return null;
    }

    return project;
  },
});

export const getUserProjects = query({
  args: {
    orgId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      orgId: v.string(),
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
  handler: async (ctx, args) => {
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, null, ["read"]);

    // Defense in depth: filter by orgId
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return projects;
  },
});

export const createProject = mutation({
  args: {
    orgId: v.string(),
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
    // Check permissions
    await checkProjectPermission(ctx, args.orgId, null, ["create"]);

    // Insert project with orgId
    const projectId = await ctx.db.insert("projects", {
      orgId: args.orgId,
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
