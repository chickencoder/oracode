import { v } from "convex/values";
import { action } from "./_generated/server";

export const getGithubRepos = action({
  args: {},
  returns: v.union(
    v.object({
      success: v.boolean(),
      repos: v.array(
        v.object({
          id: v.number(),
          name: v.string(),
          full_name: v.string(),
          owner: v.object({
            login: v.string(),
            avatar_url: v.string(),
          }),
          description: v.union(v.string(), v.null()),
          private: v.boolean(),
          html_url: v.string(),
        }),
      ),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx) => {
    // Get the current authenticated user
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Get GitHub access token from Convex Auth
    const accessToken = identity.githubAccessToken as string | undefined;

    if (!accessToken) {
      return {
        success: false,
        error: "No GitHub access token found. Please re-authenticate.",
      };
    }

    // Call GitHub API to get user's repositories
    // Using affiliation=owner,organization_member to get both personal and org repos
    try {
      const response = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `GitHub API error: ${response.status} ${errorText}`,
        };
      }

      const repos = await response.json();

      return {
        success: true,
        repos: repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url,
          },
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

export const getBranches = action({
  args: {
    fullName: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      branches: v.array(
        v.object({
          name: v.string(),
          commit: v.object({
            sha: v.string(),
            url: v.string(),
          }),
          protected: v.boolean(),
        }),
      ),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Get the current authenticated user
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Get GitHub access token from Convex Auth
    const accessToken = identity.githubAccessToken as string | undefined;

    if (!accessToken) {
      return {
        success: false,
        error: "No GitHub access token found. Please re-authenticate.",
      };
    }

    // Call GitHub API to get branches
    try {
      const response = await fetch(
        `https://api.github.com/repos/${args.fullName}/branches`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `GitHub API error: ${response.status} ${errorText}`,
        };
      }

      const branches = await response.json();

      return {
        success: true,
        branches: branches.map((branch: any) => ({
          name: branch.name,
          commit: {
            sha: branch.commit.sha,
            url: branch.commit.url,
          },
          protected: branch.protected,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch branches: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
