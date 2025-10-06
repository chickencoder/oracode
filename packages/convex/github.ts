import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { createAppAuth } from "@octokit/auth-app";
import { z } from "zod";

// Zod schemas for GitHub API responses
const githubInstallationSchema = z.object({
  id: z.number(),
  account: z.object({
    id: z.number(),
    login: z.string(),
  }),
});

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
        q.eq("installationId", args.installationId)
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

// Public: Get installation access token for an organization
export const getInstallationToken = action({
  args: {
    orgId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    // Get installation for this org
    const installation = await ctx.runQuery(api.github.getInstallation, {
      orgId: args.orgId,
    });

    if (!installation) {
      return null;
    }

    // Generate fresh installation token
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not configured");
    }

    // Format the private key correctly if it's all on one line
    // PEM format requires newlines after header and every 64 characters
    let formattedKey = privateKey;
    if (!privateKey.includes('\n')) {
      // Key is on one line, need to add newlines
      formattedKey = privateKey
        .replace('-----BEGIN PRIVATE KEY----- ', '-----BEGIN PRIVATE KEY-----\n')
        .replace(' -----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace(/(.{64})/g, '$1\n'); // Add newline every 64 chars

      // Clean up any double newlines
      formattedKey = formattedKey.replace(/\n\n/g, '\n').trim();
    }

    // Create auth instance
    const auth = createAppAuth({
      appId: parseInt(appId),
      privateKey: formattedKey,
      installationId: installation.installationId,
    });

    // Get installation access token
    const { token } = await auth({ type: "installation" });

    return token;
  },
});

// Internal: Generate GitHub App JWT for API calls
export const generateAppJWT = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx, args) => {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not configured");
    }

    // Format the private key correctly if it's all on one line
    let formattedKey = privateKey;
    if (!privateKey.includes('\n')) {
      formattedKey = privateKey
        .replace('-----BEGIN PRIVATE KEY----- ', '-----BEGIN PRIVATE KEY-----\n')
        .replace(' -----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace(/(.{64})/g, '$1\n');
      formattedKey = formattedKey.replace(/\n\n/g, '\n').trim();
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

// Internal: Generate installation access token using GitHub App credentials
export const generateInstallationToken = internalAction({
  args: {
    installationId: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not configured");
    }

    // Format the private key correctly if it's all on one line
    // PEM format requires newlines after header and every 64 characters
    let formattedKey = privateKey;
    if (!privateKey.includes('\n')) {
      // Key is on one line, need to add newlines
      formattedKey = privateKey
        .replace('-----BEGIN PRIVATE KEY----- ', '-----BEGIN PRIVATE KEY-----\n')
        .replace(' -----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace(/(.{64})/g, '$1\n'); // Add newline every 64 chars

      // Clean up any double newlines
      formattedKey = formattedKey.replace(/\n\n/g, '\n').trim();
    }

    // Create auth instance
    const auth = createAppAuth({
      appId: parseInt(appId),
      privateKey: formattedKey,
      installationId: args.installationId,
    });

    // Get installation access token
    const { token } = await auth({ type: "installation" });

    return token;
  },
});

// Public: Link Clerk organization to GitHub installation
export const linkOrganizationToInstallation = mutation({
  args: {
    orgId: v.string(),
    githubOrgLogin: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log("Linking org to installation:", args);

    // Find installation by GitHub org login
    const installation = await ctx.db
      .query("githubInstallations")
      .filter((q) => q.eq(q.field("githubOrgLogin"), args.githubOrgLogin))
      .first();

    console.log("Found installation:", installation);

    if (!installation) {
      throw new Error("Installation not found");
    }

    // Update with Clerk org ID
    await ctx.db.patch(installation._id, {
      orgId: args.orgId,
    });

    console.log("Successfully linked org", args.orgId, "to installation", installation.installationId);
  },
});

// Public: Get GitHub installation for an organization
export const getInstallation = query({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      installationId: v.number(),
      githubOrgId: v.number(),
      githubOrgLogin: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    console.log("Getting installation for orgId:", args.orgId);

    const installation = await ctx.db
      .query("githubInstallations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();

    console.log("Found installation:", installation);

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
  args: {
    orgId: v.string(),
  },
  returns: v.array(v.object({
    id: v.number(),
    name: v.string(),
    fullName: v.string(),
    description: v.union(v.string(), v.null()),
    private: v.boolean(),
    htmlUrl: v.string(),
  })),
  handler: async (ctx, args): Promise<Array<{
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
  }>> => {
    // Get installation for this org
    const installation = await ctx.runQuery(api.github.getInstallation, {
      orgId: args.orgId,
    });

    if (!installation) {
      return [];
    }

    // Generate installation token
    const token: string = await ctx.runAction(internal.github.generateInstallationToken, {
      installationId: installation.installationId,
    });

    // Fetch repositories
    const response: Response = await fetch(
      "https://api.github.com/installation/repositories",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const dataJson = await response.json();

    // Validate GitHub API response with Zod
    const data = githubRepositoriesResponseSchema.parse(dataJson);

    // Map to simpler structure
    return data.repositories.map((repo) => ({
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
          q.eq("installationId", args.installation.id)
        )
        .unique();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
    // Handle other actions (suspend, unsuspend, etc.) as needed
  },
});
