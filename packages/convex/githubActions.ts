"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { generateGitHubInstallationToken } from "./lib/githubAuth";
import { Daytona } from "@daytonaio/sdk";
import { Octokit } from "octokit";

// Public: Commit and publish changes (stage, commit with Claude, push, create PR)
export const commitAndPublish = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    success: v.boolean(),
    pullRequestUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    pullRequestUrl?: string;
    error?: string;
  }> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }

      // Get branch and project data
      const branchData = await ctx.runQuery(api.branches.getBranchWithProject, {
        branchId: args.branchId,
      });

      if (!branchData) {
        throw new Error("Branch not found");
      }

      const { branch, project } = branchData;

      if (!branch.sandboxId) {
        throw new Error("No sandbox found for this branch");
      }

      // Get GitHub installation for this org
      const installation = await ctx.runQuery(api.github.getInstallation, {});

      if (!installation) {
        throw new Error("GitHub App not installed for this organization");
      }

      // Generate installation token for push authentication
      const token: string = await generateGitHubInstallationToken(
        installation.installationId,
      );

      // Get Anthropic API key for Claude CLI
      const anthropicApiKey = await ctx.runAction(
        api.settings.getAnthropicApiKeyDecrypted,
        { orgId: identity.orgId }
      );

      if (!anthropicApiKey) {
        throw new Error("Anthropic API key not configured for this organization");
      }

      // Initialize Daytona SDK
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);
      const workDir = await sandbox.getWorkDir();
      const projectRoot = project.settings?.projectRoot
        ? `${workDir}/project/${project.settings.projectRoot}`
        : `${workDir}/project`;

      // Step 1: Stage all changes
      await ctx.runMutation(api.branches.updatePublishStatus, {
        branchId: args.branchId,
        status: {
          stage: "staging",
          message: "Staging changes...",
        },
      });

      const stageResult = await sandbox.process.executeCommand(
        "git add -A",
        projectRoot
      );

      if (stageResult.exitCode !== 0) {
        throw new Error(`Failed to stage changes: ${stageResult.result}`);
      }

      // Step 2: Run Claude commit
      await ctx.runMutation(api.branches.updatePublishStatus, {
        branchId: args.branchId,
        status: {
          stage: "committing",
          message: "Creating commit with Claude...",
        },
      });

      const commitResult = await sandbox.process.executeCommand(
        `ANTHROPIC_API_KEY="${anthropicApiKey}" claude commit --print --dangerously-skip-permissions`,
        projectRoot
      );

      if (commitResult.exitCode !== 0) {
        throw new Error(`Claude commit failed: ${commitResult.result}`);
      }

      // Step 2b: Get the commit message for PR description
      const commitMessageResult = await sandbox.process.executeCommand(
        "git log -1 --pretty=%B",
        projectRoot
      );
      const commitMessage = commitMessageResult.result.trim();

      // Parse commit message into title and body
      const commitLines = commitMessage.split('\n');
      const commitTitle = commitLines[0] || branch.branchName;
      const commitBody = commitLines.slice(1).join('\n').trim();

      // Step 3: Push to remote
      await ctx.runMutation(api.branches.updatePublishStatus, {
        branchId: args.branchId,
        status: {
          stage: "pushing",
          message: "Pushing to remote...",
        },
      });

      // Get the current remote URL and replace with authenticated version
      const remoteResult = await sandbox.process.executeCommand(
        "git config --get remote.origin.url",
        projectRoot
      );

      if (remoteResult.exitCode !== 0) {
        throw new Error("Failed to get remote URL");
      }

      const remoteUrl = remoteResult.result.trim();
      const authenticatedUrl = remoteUrl.replace(
        "https://",
        `https://x-access-token:${token}@`
      );

      // Push using git command with authenticated URL
      const pushResult = await sandbox.process.executeCommand(
        `git push ${authenticatedUrl} ${branch.branchName} --set-upstream`,
        projectRoot
      );

      if (pushResult.exitCode !== 0) {
        throw new Error(`Failed to push: ${pushResult.result}`);
      }

      // Step 4: Create PR if one doesn't exist
      let pullRequestUrl = branch.pullRequestUrl;

      if (!pullRequestUrl) {
        await ctx.runMutation(api.branches.updatePublishStatus, {
          branchId: args.branchId,
          status: {
            stage: "creating-pr",
            message: "Opening pull request...",
          },
        });

        const prResult = await ctx.runAction(api.githubActions.createPullRequest, {
          branchId: args.branchId,
          title: commitTitle,
          body: commitBody || "Pull request created from Oracode",
        });

        pullRequestUrl = prResult.pullRequestUrl;
      }

      // Step 5: Update git snapshot
      await ctx.runAction(internal.githubActions.updateGitSnapshot, {
        branchId: args.branchId,
        sandboxId: branch.sandboxId,
        projectRoot,
      });

      // Step 6: Mark complete
      await ctx.runMutation(api.branches.updatePublishStatus, {
        branchId: args.branchId,
        status: {
          stage: "complete",
          message: "Published successfully!",
          pullRequestUrl,
        },
      });

      return {
        success: true,
        pullRequestUrl,
      };
    } catch (error) {
      console.error("commitAndPublish failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Update status with error
      await ctx.runMutation(api.branches.updatePublishStatus, {
        branchId: args.branchId,
        status: {
          stage: "complete",
          error: errorMessage,
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

// Public: Create a pull request for a branch
export const createPullRequest = action({
  args: {
    branchId: v.id("branches"),
    title: v.string(),
    body: v.optional(v.string()),
  },
  returns: v.object({
    pullRequestUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ pullRequestUrl: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }

    // Get branch and project data
    const branchData = await ctx.runQuery(api.branches.getBranchWithProject, {
      branchId: args.branchId,
    });

    if (!branchData) {
      throw new Error("Branch not found");
    }

    const { branch, project } = branchData;

    // Get GitHub installation for this org
    const installation = await ctx.runQuery(api.github.getInstallation, {});

    if (!installation) {
      throw new Error("GitHub App not installed for this organization");
    }

    // Generate installation token
    const token: string = await generateGitHubInstallationToken(
      installation.installationId,
    );

    // Create Octokit instance
    const octokit = new Octokit({ auth: token });

    // Get repository information
    // Note: We need to fetch repo by ID first to get the name
    const reposResponse = await octokit.rest.repos.listForOrg({
      org: installation.githubOrgLogin,
    });

    const repo = reposResponse.data.find((r: any) => r.id === project.githubRepoId);

    if (!repo) {
      throw new Error("Repository not found");
    }

    // Get default branch
    const defaultBranch: string = repo.default_branch || "main";

    // Create pull request
    const prResponse = await octokit.rest.pulls.create({
      owner: installation.githubOrgLogin,
      repo: repo.name,
      title: args.title,
      body: args.body || "",
      head: branch.branchName,
      base: defaultBranch,
    });

    const pullRequestUrl: string = prResponse.data.html_url;

    // Store PR URL in branch
    await ctx.runMutation(api.branches.updatePullRequest, {
      branchId: args.branchId,
      pullRequestUrl,
    });

    return { pullRequestUrl };
  },
});

// Internal: Update git snapshot after commits/pushes
export const updateGitSnapshot = internalAction({
  args: {
    branchId: v.id("branches"),
    sandboxId: v.string(),
    projectRoot: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Initialize Daytona SDK
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
      apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
      target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
    });

    const sandbox = await daytona.get(args.sandboxId);

    // Get current branch name
    const branchResult = await sandbox.process.executeCommand(
      "git rev-parse --abbrev-ref HEAD",
      args.projectRoot
    );
    const currentBranch = branchResult.result.trim();

    // Get HEAD commit SHA
    const commitResult = await sandbox.process.executeCommand(
      "git rev-parse HEAD",
      args.projectRoot
    );
    const headCommit = commitResult.result.trim();

    // Get git status in porcelain format
    const statusResult = await sandbox.process.executeCommand(
      "git status --porcelain",
      args.projectRoot
    );

    // Parse status output
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const deleted: string[] = [];

    const lines = statusResult.result.split("\n").filter((line) => line.length > 0);

    for (const line of lines) {
      const indexStatus = line[0];
      const workingStatus = line[1];
      const filename = line.substring(3).trim();

      // Index (staged) changes
      if (indexStatus === "A" || indexStatus === "M" || indexStatus === "D") {
        staged.push(filename);
      }

      // Working tree (unstaged) changes
      if (workingStatus === "M") {
        modified.push(filename);
      } else if (workingStatus === "D") {
        deleted.push(filename);
      }

      // Untracked files
      if (indexStatus === "?" && workingStatus === "?") {
        untracked.push(filename);
      }
    }

    const hasUncommittedChanges =
      staged.length > 0 ||
      modified.length > 0 ||
      untracked.length > 0 ||
      deleted.length > 0;

    // Update snapshot
    await ctx.runMutation(api.snapshots.updateSnapshot, {
      branchId: args.branchId,
      currentBranch,
      headCommit,
      hasUncommittedChanges,
      staged,
      modified,
      untracked,
      deleted,
    });
  },
});
