import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { api } from "./_generated/api";
import { createAppAuth } from "@octokit/auth-app";
import { z } from "zod";

const githubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  html_url: z.string(),
});

const githubRepositoriesResponseSchema = z.object({
  total_count: z.number().optional(),
  repositories: z.array(githubRepositorySchema),
});

// Public: Create a state token for GitHub App installation flow
export const createInstallationState = mutation({
  args: {
    userId: v.string(),
    orgId: v.optional(v.string()),
  },
  returns: v.object({
    stateToken: v.string(),
  }),
  handler: async (ctx, args) => {
    // Generate random state token
    const stateToken = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 1000 * 60 * 15; // 15 minutes

    // Store state in database
    await ctx.db.insert("githubAppState", {
      stateToken,
      userId: args.userId,
      orgId: args.orgId,
      createdAt: now,
      expiresAt,
    });

    return { stateToken };
  },
});

// Internal: Store GitHub installation after callback
export const storeInstallation = internalMutation({
  args: {
    stateToken: v.string(),
    installationId: v.number(),
    githubOrgId: v.number(),
    githubOrgLogin: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify and get state
    const state = await ctx.db
      .query("githubAppState")
      .withIndex("by_state", (q) => q.eq("stateToken", args.stateToken))
      .unique();

    if (!state) {
      throw new Error("Invalid state token");
    }

    if (state.expiresAt < Date.now()) {
      throw new Error("State token expired");
    }

    // Check if installation already exists
    const existing = await ctx.db
      .query("githubInstallations")
      .withIndex("by_installation_id", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();

    if (existing) {
      // Update existing installation
      await ctx.db.patch(existing._id, {
        githubOrgId: args.githubOrgId,
        githubOrgLogin: args.githubOrgLogin,
        installedAt: Date.now(),
      });
    } else {
      // Create new installation record (orgId will be added later by frontend)
      await ctx.db.insert("githubInstallations", {
        orgId: state.orgId || "", // Will be updated later when Clerk org is created
        githubOrgId: args.githubOrgId,
        githubOrgLogin: args.githubOrgLogin,
        installationId: args.installationId,
        installedBy: state.userId,
        installedAt: Date.now(),
      });
    }

    // Delete used state token
    await ctx.db.delete(state._id);
  },
});

// Internal: Generate GitHub App JWT for API calls
export const generateAppToken = internalAction({
  args: {},
  returns: v.string(),
  handler: async () => {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not configured");
    }

    // Format the private key correctly if it's all on one line
    let formattedKey = privateKey;
    if (!privateKey.includes("\n")) {
      formattedKey = privateKey
        .replace(
          "-----BEGIN PRIVATE KEY----- ",
          "-----BEGIN PRIVATE KEY-----\n",
        )
        .replace(" -----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----")
        .replace(/(.{64})/g, "$1\n");
      formattedKey = formattedKey.replace(/\n\n/g, "\n").trim();
    }

    // Create auth instance without installation ID to get JWT
    const auth = createAppAuth({
      appId: parseInt(appId),
      privateKey: formattedKey,
    });

    // Get JWT token
    const { token } = await auth({ type: "app" });
    return token;
  },
});

// Public: Link Clerk organization to GitHub installation
export const linkOrganizationToInstallation = mutation({
  args: {
    githubOrgLogin: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Find installation by GitHub org login
    const installation = await ctx.db
      .query("githubInstallations")
      .filter((q) => q.eq(q.field("githubOrgLogin"), args.githubOrgLogin))
      .first();

    if (!installation) {
      throw new Error("Installation not found");
    }

    // Clean up any old installations for this orgId before linking the new one
    const existingInstallations = await ctx.db
      .query("githubInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    for (const existing of existingInstallations) {
      // Delete old installations that are different from the one we're linking
      if (existing._id !== installation._id) {
        await ctx.db.delete(existing._id);
      }
    }

    // Update with Clerk org ID
    await ctx.db.patch(installation._id, {
      orgId,
    });
  },
});

// Public: Get GitHub installation for an organization
export const getInstallation = query({
  args: {},
  returns: v.union(
    v.object({
      installationId: v.number(),
      githubOrgId: v.number(),
      githubOrgLogin: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    // Get orgId from authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      return null;
    }
    const orgId = identity.orgId;

    // Use .first() instead of .unique() to handle multiple installations
    // (e.g., if app was uninstalled and reinstalled)
    const installation = await ctx.db
      .query("githubInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .first();

    if (!installation) {
      return null;
    }

    return {
      installationId: installation.installationId,
      githubOrgId: installation.githubOrgId,
      githubOrgLogin: installation.githubOrgLogin,
    };
  },
});

// Public: List repositories accessible through the installation
export const listRepositories = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
      fullName: v.string(),
      description: v.union(v.string(), v.null()),
      private: v.boolean(),
      htmlUrl: v.string(),
    }),
  ),
  handler: async (
    ctx,
  ): Promise<
    Array<{
      id: number;
      name: string;
      fullName: string;
      description: string | null;
      private: boolean;
      htmlUrl: string;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }

    // Get installation for this org
    const installation = await ctx.runQuery(api.github.getInstallation, {});

    if (!installation) {
      return [];
    }

    // Generate installation token inline
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not configured");
    }

    // Format the private key correctly if it's all on one line
    let formattedKey = privateKey;
    if (!privateKey.includes("\n")) {
      formattedKey = privateKey
        .replace(
          "-----BEGIN PRIVATE KEY----- ",
          "-----BEGIN PRIVATE KEY-----\n",
        )
        .replace(" -----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----")
        .replace(/(.{64})/g, "$1\n");
      formattedKey = formattedKey.replace(/\n\n/g, "\n").trim();
    }

    // Create auth instance
    const auth = createAppAuth({
      appId: parseInt(appId),
      privateKey: formattedKey,
      installationId: installation.installationId,
    });

    // Get installation access token
    const { token } = await auth({ type: "installation" });

    // Fetch all repositories with pagination
    let allRepos: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      html_url: string;
    }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response: Response = await fetch(
        `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GitHub API error:", response.status, errorText);
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const dataJson = await response.json();

      // Validate GitHub API response with Zod
      const data = githubRepositoriesResponseSchema.parse(dataJson);

      allRepos = allRepos.concat(data.repositories);

      // Check if there are more pages
      hasMore = data.repositories.length === 100;
      page++;
    }

    // Map to simpler structure
    return allRepos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
    }));
  },
});

// Internal: Handle GitHub installation webhook events
export const handleInstallationEvent = internalMutation({
  args: {
    action: v.string(),
    installation: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.action === "deleted") {
      // Remove installation from database
      const existing = await ctx.db
        .query("githubInstallations")
        .withIndex("by_installation_id", (q) =>
          q.eq("installationId", args.installation.id),
        )
        .unique();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
    // Handle other actions (suspend, unsuspend, etc.) as needed
  },
});
