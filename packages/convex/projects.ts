import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Generate a URL-friendly slug from a name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

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
      projectRoot: v.optional(v.string()),
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

    // Generate slug from name
    let slug = slugify(args.name);

    // Check if slug already exists in this org
    const existingProject = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) => q.eq("orgId", orgId).eq("slug", slug))
      .first();

    if (existingProject) {
      // Append random suffix to make unique
      slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Create the project
    const projectId = await ctx.db.insert("projects", {
      orgId,
      githubRepoId: args.githubRepoId,
      name: args.name,
      slug,
      description: args.description ?? "",
      settings: args.settings,
      createdAt: Date.now(),
    });

    return projectId;
  },
});

// Get a single project by ID
export const getProjectById = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      githubRepoId: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
        projectRoot: v.optional(v.string()),
      }),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Get the project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.orgId !== orgId) {
      throw new Error("Not authorized to access this project");
    }

    // Return without orgId
    return {
      _id: project._id,
      githubRepoId: project.githubRepoId,
      name: project.name,
      slug: project.slug || slugify(project.name), // Fallback to generated slug
      description: project.description,
      settings: project.settings,
      createdAt: project.createdAt,
    };
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
      slug: v.optional(v.string()),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
        projectRoot: v.optional(v.string()),
      }),
      createdAt: v.number(),
    }),
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
      slug: project.slug || slugify(project.name), // Fallback to generated slug
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
      projectRoot: v.optional(v.string()),
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

// Public query to get project by ID (for proxy service)
export const getProjectByIdPublic = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      githubRepoId: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
        projectRoot: v.optional(v.string()),
      }),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // No auth check - this is intentionally public for the proxy service
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    return {
      _id: project._id,
      githubRepoId: project.githubRepoId,
      name: project.name,
      slug: project.slug || slugify(project.name), // Fallback to generated slug
      description: project.description,
      settings: project.settings,
      createdAt: project.createdAt,
    };
  },
});

// Get project by orgId and slug
export const getProjectByOrgAndSlug = query({
  args: {
    orgId: v.string(),
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      githubRepoId: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.string(),
      settings: v.object({
        installCommand: v.string(),
        devCommand: v.string(),
        port: v.number(),
        projectRoot: v.optional(v.string()),
      }),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Query projects for this org matching the slug
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", args.slug))
      .first();

    if (!project) {
      return null;
    }

    return {
      _id: project._id,
      githubRepoId: project.githubRepoId,
      name: project.name,
      slug: project.slug || slugify(project.name), // Fallback to generated slug
      description: project.description,
      settings: project.settings,
      createdAt: project.createdAt,
    };
  },
});

// Note: Environment variables are now managed through variables.ts
// This mutation has been removed as env vars are stored separately in the secrets table

// Delete a project and all associated branches
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

    // Delete all branches associated with this project
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const branch of branches) {
      // Delete all messages for each branch
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_branch", (q) => q.eq("branchId", branch._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete the branch
      await ctx.db.delete(branch._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);

    return null;
  },
});
