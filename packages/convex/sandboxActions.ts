"use node";

import { v, type Infer } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { Daytona } from "@daytonaio/sdk";
import ms from "ms";
import {
  generateGitHubInstallationToken,
  getRepositoryCloneUrl,
} from "./lib/githubAuth";
import { injectWorkerIntoSandbox } from "./lib/sandbox";
import { generateClerkTokenForConvex } from "./lib/clerkAuth";
import { buildOracodeImage } from "./lib/daytonaImage";
import { buildEnvExports } from "./lib/shellUtils";

/**
 * Generate URL-friendly slug from a name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Build preview URL from org, project, and branch information
 * Format: {branchName}-{projectSlug}-{orgSlug}.preview.oracode.local
 */
async function buildPreviewUrl(
  ctx: ActionCtx,
  branchName: string,
  projectSlug: string,
  orgId: string,
): Promise<string> {
  // Get organization to get slug
  const org = await ctx.runQuery(api.organizations.getByClerkId, {
    clerkOrgId: orgId,
  });

  if (!org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  const slugifiedBranchName = slugify(branchName);
  const host =
    process.env.NODE_ENV === "production"
      ? "preview.oracode.dev"
      : "preview.oracode.local";

  return `https://${slugifiedBranchName}-${projectSlug}-${org.slug}.${host}`;
}

// Helper function to build dev command with environment variables
async function buildDevCommandWithEnv(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  baseCommand: string,
): Promise<string> {
  try {
    const envVars = await ctx.runAction(api.variables.getAllDecrypted, {
      projectId,
    });

    if (Object.keys(envVars).length > 0) {
      const envExports = buildEnvExports(envVars);
      console.log(
        `Dev command will run with ${Object.keys(envVars).length} environment variables`,
      );
      return `${envExports} && ${baseCommand}`;
    }
  } catch (error) {
    console.warn("Failed to load environment variables:", error);
  }

  return baseCommand;
}

// Action to start a sandbox for a branch
export const startSandbox = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== startSandbox action called ===");
    console.log("Branch ID:", args.branchId);

    try {
      // Step 1: Get auth and verify branch ownership
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }
      console.log("Authenticated user org:", identity.orgId);

      // Step 1b: Generate Clerk token for worker authentication
      const clerkUserId = identity.subject;
      if (!clerkUserId) {
        throw new Error("No Clerk user ID found in identity");
      }
      const clerkToken = await generateClerkTokenForConvex(
        clerkUserId,
        identity.orgId,
      );

      // Step 2: Check for existing sandbox in branch
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });
      if (!branch) {
        throw new Error("Branch not found");
      }

      console.log("Branch sandbox status:", branch.sandboxStatus);
      console.log("Branch name:", branch.branchName);

      // Step 3: Handle existing sandbox scenarios
      if (branch.sandboxStatus) {
        // If already creating, return error to prevent duplicates
        if (branch.sandboxStatus === "provisioning" || branch.sandboxStatus === "starting") {
          throw new Error(
            "A sandbox is already being created for this branch. Please wait.",
          );
        }

        // If running, return existing
        if (branch.sandboxStatus === "running") {
          console.log("Returning existing running sandbox");
          return {
            sandboxId: branch.sandboxId!,
            domain: branch.sandboxDomain!,
            status: "running",
          };
        }

        console.log(
          "Existing sandbox is stopped/archived or errored, will restart it",
        );
      }

      // Step 4: Initialize sandbox in branch with "creating" status FIRST
      console.log("Initializing sandbox creation");

      await ctx.runMutation(api.branches.initBranchSandbox, {
        branchId: args.branchId,
      });

      console.log("Branch sandbox initialized");

      // Step 5: Update stage to "provisioning"
      await ctx.runMutation(api.branches.updateBranchSandboxStage, {
        branchId: args.branchId,
        stage: "provisioning",
      });

      // Step 6: Get project and GitHub installation details
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: branch.projectId,
      });
      if (!project) {
        throw new Error("Project not found");
      }

      console.log("Project:", {
        id: project._id,
        githubRepoId: project.githubRepoId,
        port: project.settings.port,
      });

      // Get GitHub installation
      const installation = await ctx.runQuery(api.github.getInstallation, {});
      if (!installation) {
        throw new Error(
          "No GitHub installation found for this organization. Please install the GitHub App first.",
        );
      }

      console.log("GitHub installation:", installation.installationId);

      // Step 7: Generate GitHub token and get repo URL
      const githubToken = await generateGitHubInstallationToken(
        installation.installationId,
      );
      console.log("Generated GitHub installation token");

      const { cloneUrl, defaultBranch } = await getRepositoryCloneUrl(
        githubToken,
        project.githubRepoId,
      );
      console.log("Repository clone URL:", cloneUrl);
      console.log("Default branch:", defaultBranch);

      // Step 8: Initialize Daytona SDK
      console.log("Initializing Daytona client...");
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      // Step 9: Create Daytona Sandbox (without volume for now - Git needs local filesystem)
      console.log("Creating Daytona Sandbox...");
      const baseImage = buildOracodeImage();

      let sandbox;
      try {
        sandbox = await daytona.create(
          {
            image: baseImage,
            envVars: {
              NODE_ENV: "development",
            },
            public: true,
            resources: {
              cpu: 2, // 2 vCPUs for better performance
              memory: 4, // 4GB RAM for npm installs
              disk: 10, // 10GB disk (max allowed, up from 3GB default)
            },
          },
          {
            timeout: 0, // No timeout - wait indefinitely
            onSnapshotCreateLogs: (chunk: string) =>
              console.log("Build:", chunk),
          },
        );
      } catch (error: any) {
        console.error("Failed to create workspace:", error);
        console.error("Error response:", error.response?.data);
        throw error;
      }

      // Use the sandbox ID directly (no .instance in SDK 0.109.0)
      const sandboxId = sandbox.id;
      console.log("Daytona Sandbox created");
      console.log("Sandbox ID:", sandboxId);
      console.log("Initial state:", sandbox.state);

      // Start the sandbox (it's created in stopped state)
      console.log("Starting sandbox...");
      await sandbox.start();

      // Wait for sandbox to be ready using SDK method
      console.log("Waiting for sandbox to be started...");
      await sandbox.waitUntilStarted(0); // 0 = wait indefinitely
      console.log("Sandbox started successfully!");

      // Step 10: Configure auto-stop interval (10 minutes)
      console.log("Configuring 10-minute auto-stop interval");
      await sandbox.setAutostopInterval(10);
      console.log("Auto-stop configured");

      // Step 11: Store sandboxId and status
      await ctx.runMutation(api.branches.updateBranchSandbox, {
        branchId: args.branchId,
        sandboxId: sandboxId,
      });
      await ctx.runMutation(api.branches.updateBranchSandboxState, {
        branchId: args.branchId,
        state: "running",
      });
      console.log("Stored sandbox ID and status as running");

      // Step 12: Get working directory
      // (pnpm + Claude SDK are pre-installed in the declarative image)
      const workDir = await sandbox.getWorkDir();
      console.log("Working directory:", workDir);

      // Calculate project root path (includes optional subdirectory)
      const projectRoot = project.settings.projectRoot
        ? `${workDir}/project/${project.settings.projectRoot}`
        : `${workDir}/project`;
      console.log("Project root (where agent will run):", projectRoot);

      // Step 13: Clone repository using Daytona's Git API
      console.log("Cloning repository:", cloneUrl);
      console.log("Into directory:", `${workDir}/project`);

      // Use Daytona's built-in Git API with authentication
      await sandbox.git.clone(
        cloneUrl,
        `${workDir}/project`,
        defaultBranch,
        undefined, // commitId
        "x-access-token",
        githubToken,
      );

      console.log("Repository cloned successfully");

      // Step 13b: Checkout the git branch (create if doesn't exist)
      console.log("Checking out git branch:", branch.branchName);
      const checkoutResult = await sandbox.process.executeCommand(
        `git checkout -B ${branch.branchName}`,
        `${workDir}/project`,
      );

      if (checkoutResult.exitCode !== 0) {
        console.warn(
          "Failed to checkout branch, continuing with default:",
          checkoutResult.result,
        );
      } else {
        console.log("Git branch checked out successfully");
      }

      // Step 14: Update stage to "installing"
      await ctx.runMutation(api.branches.updateBranchSandboxStage, {
        branchId: args.branchId,
        stage: "installing",
      });

      // Step 15: Run install command
      // pnpm is pre-installed in the declarative image
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.process.executeCommand(
        project.settings.installCommand,
        projectRoot,
      );

      console.log("Install result:", {
        exitCode: installResult.exitCode,
        result: installResult.result,
      });

      if (installResult.exitCode !== 0) {
        throw new Error(
          `Install command failed with exit code ${installResult.exitCode}:\n${installResult.result || "(no output)"}`,
        );
      }
      console.log("Install command completed successfully");

      // Step 16: Fetch and decrypt secrets for dev server and worker
      console.log("Fetching organization and project secrets...");
      let anthropicApiKey: string | undefined;
      let projectEnvVars: Record<string, string> | undefined;

      try {
        // Fetch org's Anthropic API key
        const orgApiKey = await ctx.runAction(
          api.settings.getAnthropicApiKeyDecrypted,
          {
            orgId: identity.orgId,
          },
        );
        if (orgApiKey) {
          anthropicApiKey = orgApiKey;
          console.log("✓ Anthropic API key found for organization");
        } else {
          console.log("ℹ No Anthropic API key configured for organization");
          // Fallback to Convex env var
          if (process.env.ANTHROPIC_API_KEY) {
            anthropicApiKey = process.env.ANTHROPIC_API_KEY;
            console.log("✓ Using Anthropic API key from Convex environment");
          }
        }

        // Fetch project environment variables
        const envVars = await ctx.runAction(
          api.variables.getAllDecrypted,
          {
            projectId: branch.projectId,
          },
        );
        if (Object.keys(envVars).length > 0) {
          projectEnvVars = envVars;
          console.log(
            `✓ ${Object.keys(envVars).length} project environment variables loaded`,
          );
        } else {
          console.log("ℹ No project environment variables configured");
        }
      } catch (secretError) {
        console.warn(
          "⚠️ Failed to load secrets, continuing without them:",
          secretError,
        );
        // Still try to use Convex env var as fallback
        if (process.env.ANTHROPIC_API_KEY) {
          anthropicApiKey = process.env.ANTHROPIC_API_KEY;
          console.log(
            "✓ Using Anthropic API key from Convex environment (fallback)",
          );
        }
      }

      // Step 17: Update stage to "starting"
      await ctx.runMutation(api.branches.updateBranchSandboxStage, {
        branchId: args.branchId,
        stage: "starting",
      });

      // Step 18: Start dev server in Daytona session
      console.log(
        "Starting dev server in session:",
        project.settings.devCommand,
      );

      // Create a persistent session for the dev server
      const devSessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(devSessionId);

      // Build dev command with environment variables (using shared helper)
      const baseDevCommand = `cd ${projectRoot} && ${project.settings.devCommand}`;
      const devCommand = await buildDevCommandWithEnv(
        ctx,
        branch.projectId,
        baseDevCommand,
      );

      // Execute dev command asynchronously in the session
      const devResult = await sandbox.process.executeSessionCommand(
        devSessionId,
        {
          command: devCommand,
          runAsync: true, // Run in background
        },
      );

      console.log("Dev server started in session:", devSessionId);
      console.log("Command ID:", devResult.cmdId);

      // Store session ID in Convex for later monitoring
      if (devResult.cmdId) {
        await ctx.runMutation(api.branches.updateBranchDevServerSession, {
          branchId: args.branchId,
          devSessionId: devSessionId,
          devCommandId: devResult.cmdId,
        });
      }

      // Check logs to verify server started
      if (devResult.cmdId) {
        const logsResponse = await sandbox.process.getSessionCommandLogs(
          devSessionId,
          devResult.cmdId,
        );
        const logs = logsResponse.output || "";
        console.log("Dev server logs:", logs.substring(0, 500));

        // Basic check - if logs contain common error patterns, throw
        if (
          logs.toLowerCase().includes("error") &&
          logs.toLowerCase().includes("failed")
        ) {
          throw new Error(`Dev server failed to start. Logs:\n${logs}`);
        }
      }

      // Step 18: Get domain/preview URL using Daytona's preview link API
      console.log("Getting preview link for port:", project.settings.port);
      const previewLink = await sandbox.getPreviewLink(project.settings.port);
      const daytonaDomain = previewLink.url;
      const previewToken = previewLink.token;
      console.log("Daytona sandbox domain:", daytonaDomain);
      console.log("Preview token:", previewToken ? "present" : "none");

      // Build our custom preview URL
      const projectSlug = project.slug || slugify(project.name);
      const customPreviewUrl = await buildPreviewUrl(
        ctx,
        branch.branchName,
        projectSlug,
        identity.orgId,
      );
      console.log("Custom preview URL:", customPreviewUrl);

      // Store both Daytona domain (for internal proxy use) and custom preview URL
      // The sandboxDomain field will store the Daytona domain for backend proxy
      await ctx.runMutation(api.branches.updateBranchSandboxDomain, {
        branchId: args.branchId,
        domain: daytonaDomain,
        previewToken,
      });
      console.log("Stored sandbox domain and token");

      // Step 19: Inject sandbox worker
      // Note: Claude Code CLI is pre-installed in the Docker image as a native binary
      console.log("Injecting sandbox worker...");

      const convexUrl = process.env.CONVEX_URL;
      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: sandboxId,
          convexUrl,
          branchId: args.branchId,
          clerkToken,
          anthropicApiKey,
          projectEnvVars,
          projectRoot: projectRoot,
        });

        if (!workerResult.success) {
          console.warn(
            "⚠️ Failed to inject worker, continuing without it:",
            workerResult.error,
          );
        } else {
          console.log("Sandbox worker injected successfully");

          // Store worker session IDs for monitoring
          if (workerResult.sessionId && workerResult.commandId) {
            await ctx.runMutation(api.branches.updateBranchWorkerSession, {
              branchId: args.branchId,
              workerSessionId: workerResult.sessionId,
              workerCommandId: workerResult.commandId,
            });
          }
        }
      }

      // Step 20: Clear loading stage (sandbox is ready)
      await ctx.runMutation(api.branches.clearBranchSandboxLoadingStage, {
        branchId: args.branchId,
      });

      console.log("=== startSandbox action complete ===");

      return {
        sandboxId: sandboxId,
        domain: customPreviewUrl,
        status: "running",
      };
    } catch (error) {
      console.error("=== startSandbox action failed ===");
      console.error("Error:", error);

      // Try to update branch sandbox with error
      try {
        const branch = await ctx.runQuery(api.branches.getBranchById, {
          branchId: args.branchId,
        });
        if (branch && (branch.sandboxStatus === "provisioning" || branch.sandboxStatus === "starting")) {
          await ctx.runMutation(api.branches.updateBranchSandboxError, {
            branchId: args.branchId,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          });
        }
      } catch (updateError) {
        console.error("Failed to update sandbox error status:", updateError);
      }

      throw error;
    }
  },
});

// Action to restart an existing sandbox (stop then start to preserve files)
export const restartSandbox = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== restartSandbox action called ===");
    console.log("Branch ID:", args.branchId);

    try {
      // Step 1: Get auth and verify branch ownership
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }

      // Step 2: Get existing sandbox from branch
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });

      if (!branch) {
        throw new Error("Branch not found");
      }

      if (!branch.sandboxId) {
        throw new Error("No sandbox found for this branch");
      }

      // Check if sandbox is already running - return early (idempotent)
      if (branch.sandboxStatus === "running") {
        console.log("Sandbox is already running, returning current state");
        return {
          sandboxId: branch.sandboxId,
          domain: branch.sandboxDomain || "",
          status: "running",
        };
      }

      console.log("Restarting sandbox - will stop and start to preserve files:", branch.sandboxId);

      // Step 3: Update status to "creating" (restarting)
      await ctx.runMutation(api.branches.initBranchSandbox, {
        branchId: args.branchId,
      });

      // Step 4: Connect to existing sandbox
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);
      console.log("Reconnected to sandbox");

      // Step 5: Stop the sandbox (if it's running)
      console.log("Stopping sandbox...");
      try {
        await sandbox.stop(0); // Wait indefinitely for stop
        console.log("Sandbox stopped successfully");
      } catch (error) {
        console.warn("Failed to stop sandbox (might already be stopped):", error);
        // Continue anyway - we'll try to start it
      }

      // Step 6: Start the sandbox (same as resume from here)
      console.log("Starting sandbox...");
      await sandbox.start();
      await sandbox.waitUntilStarted(0);
      console.log("Sandbox started successfully");

      // Step 6b: Configure auto-stop interval (10 minutes)
      console.log("Configuring 10-minute auto-stop interval");
      await sandbox.setAutostopInterval(10);
      console.log("Auto-stop configured");

      // Update state to started
      await ctx.runMutation(api.branches.updateBranchSandboxState, {
        branchId: args.branchId,
        state: "running",
      });
      console.log("Updated sandbox state to started");

      // Step 7: Restart dev server (it's not running after restart)
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: branch.projectId,
      });

      if (!project) {
        throw new Error("Project not found");
      }

      console.log("Restarting dev server:", project.settings.devCommand);

      // Get working directory and calculate project root path (same as start)
      const workDir = await sandbox.getWorkDir();
      const projectRoot = project.settings.projectRoot
        ? `${workDir}/project/${project.settings.projectRoot}`
        : `${workDir}/project`;
      console.log("Project root (where dev server will run):", projectRoot);

      // Always create a new session on restart (old sessions are destroyed when sandbox stops)
      const devSessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(devSessionId);
      console.log("Created new dev session:", devSessionId);

      // Build dev command with environment variables
      const baseDevCommand = `cd ${projectRoot} && ${project.settings.devCommand}`;
      const devCommand = await buildDevCommandWithEnv(
        ctx,
        branch.projectId,
        baseDevCommand,
      );

      // Start dev server in session
      const devResult = await sandbox.process.executeSessionCommand(devSessionId, {
        command: devCommand,
        runAsync: true,
      });

      console.log("Dev server started in session:", devSessionId);

      // Store new session IDs
      if (devResult.cmdId) {
        await ctx.runMutation(api.branches.updateBranchDevServerSession, {
          branchId: args.branchId,
          devSessionId: devSessionId,
          devCommandId: devResult.cmdId,
        });
      }

      // Step 8: Get fresh preview link
      console.log("Getting preview link for port:", project.settings.port);
      const previewLink = await sandbox.getPreviewLink(project.settings.port);
      const domain = previewLink.url;
      const previewToken = previewLink.token;
      console.log("Sandbox domain:", domain);

      // Step 9: Update status back to "ready" with fresh preview URL
      await ctx.runMutation(api.branches.updateBranchSandboxReady, {
        branchId: args.branchId,
        sandboxId: branch.sandboxId,
        domain,
        previewToken,
      });

      // Step 10: Inject sandbox worker (needs to be restarted after restart)
      console.log("Injecting sandbox worker...");

      // Generate Clerk token for worker authentication
      const clerkUserId = identity.subject;
      if (!clerkUserId) {
        throw new Error("No Clerk user ID found in identity");
      }
      const clerkToken = await generateClerkTokenForConvex(
        clerkUserId,
        identity.orgId,
      );

      // Fetch secrets for worker
      let anthropicApiKey: string | undefined;
      let projectEnvVars: Record<string, string> | undefined;

      try {
        // Fetch org's Anthropic API key
        const orgApiKey = await ctx.runAction(
          api.settings.getAnthropicApiKeyDecrypted,
          { orgId: identity.orgId },
        );
        if (orgApiKey) {
          anthropicApiKey = orgApiKey;
          console.log("✓ Anthropic API key found for organization");
        } else if (process.env.ANTHROPIC_API_KEY) {
          anthropicApiKey = process.env.ANTHROPIC_API_KEY;
          console.log("✓ Using Anthropic API key from Convex environment");
        }

        // Fetch project environment variables
        const envVars = await ctx.runAction(api.variables.getAllDecrypted, {
          projectId: branch.projectId,
        });
        if (Object.keys(envVars).length > 0) {
          projectEnvVars = envVars;
          console.log(
            `✓ ${Object.keys(envVars).length} project environment variables loaded`,
          );
        }
      } catch (secretError) {
        console.warn("⚠️ Failed to load secrets, continuing without them:", secretError);
        if (process.env.ANTHROPIC_API_KEY) {
          anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        }
      }

      const convexUrl = process.env.CONVEX_URL;
      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: branch.sandboxId,
          convexUrl,
          branchId: args.branchId,
          clerkToken,
          anthropicApiKey,
          projectEnvVars,
          projectRoot,
        });

        if (!workerResult.success) {
          console.warn(
            "⚠️ Failed to inject worker, continuing without it:",
            workerResult.error,
          );
        } else {
          console.log("Sandbox worker injected successfully");

          // Store worker session IDs for monitoring
          if (workerResult.sessionId && workerResult.commandId) {
            await ctx.runMutation(api.branches.updateBranchWorkerSession, {
              branchId: args.branchId,
              workerSessionId: workerResult.sessionId,
              workerCommandId: workerResult.commandId,
            });
          }
        }
      }

      console.log("=== restartSandbox action complete ===");

      return {
        sandboxId: branch.sandboxId,
        domain,
        status: "running",
      };
    } catch (error) {
      console.error("=== restartSandbox action failed ===");
      console.error("Error:", error);

      // Update branch sandbox with error
      try {
        const branch = await ctx.runQuery(api.branches.getBranchById, {
          branchId: args.branchId,
        });
        if (branch) {
          await ctx.runMutation(api.branches.updateBranchSandboxError, {
            branchId: args.branchId,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          });
        }
      } catch (updateError) {
        console.error("Failed to update sandbox error status:", updateError);
      }

      throw error;
    }
  },
});

// Action to retry a failed sandbox (delegates to restartSandbox)
export const retrySandbox = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log(
      "=== retrySandbox action called (delegating to restartSandbox) ===",
    );

    // Simply delegate to restartSandbox - it handles all cases (stopped/archived/errored)
    return await ctx.runAction(api.sandboxActions.restartSandbox, {
      branchId: args.branchId,
    });
  },
});

// Debug action to get worker logs
export const getWorkerLogs = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    success: v.boolean(),
    logs: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });

      if (!branch?.sandboxId) {
        throw new Error("No sandbox found");
      }

      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);

      // Get worker logs from file
      const result = await sandbox.process.executeCommand(
        "tail -n 100 /tmp/worker.log 2>&1 || echo 'No logs found'"
      );

      return {
        success: true,
        logs: result.result || "No output",
      };
    } catch (error) {
      console.error("Failed to fetch worker logs:", error);
      return {
        logs: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Action to resume a stopped sandbox (lighter than restart - just starts it)
export const resumeSandbox = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== resumeSandbox action called ===");
    console.log("Branch ID:", args.branchId);

    try {
      // Step 1: Get auth and verify branch ownership
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }

      // Step 2: Get existing sandbox from branch
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });

      if (!branch) {
        throw new Error("Branch not found");
      }

      if (!branch.sandboxId) {
        throw new Error("No sandbox found for this branch");
      }

      // Check if sandbox is stopped (based on sandboxState from Daytona webhooks)
      const isStopped = branch.sandboxStatus === "stopped" || branch.sandboxStatus === "archived";

      if (!isStopped) {
        console.log("Sandbox is not stopped, returning current state");
        return {
          sandboxId: branch.sandboxId,
          domain: branch.sandboxDomain || "",
          status: branch.sandboxStatus || "ready",
        };
      }

      console.log("Resuming stopped sandbox:", branch.sandboxId);

      // Step 3: Update status to "creating" (resuming)
      await ctx.runMutation(api.branches.initBranchSandbox, {
        branchId: args.branchId,
      });

      // Step 4: Reconnect to existing Sandbox
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);
      console.log("Reconnected to sandbox");

      // Step 5: Start the sandbox
      console.log("Starting sandbox...");
      await sandbox.start();
      await sandbox.waitUntilStarted(0);
      console.log("Sandbox started successfully");

      // Step 5b: Configure auto-stop interval (10 minutes)
      console.log("Configuring 10-minute auto-stop interval");
      await sandbox.setAutostopInterval(10);
      console.log("Auto-stop configured");

      // Update state to started
      await ctx.runMutation(api.branches.updateBranchSandboxState, {
        branchId: args.branchId,
        state: "running",
      });
      console.log("Updated sandbox state to started");

      // Step 6: Restart dev server (it's not running after resume)
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: branch.projectId,
      });

      if (!project) {
        throw new Error("Project not found");
      }

      console.log("Restarting dev server:", project.settings.devCommand);

      // Get working directory and calculate project root path (same as start)
      const workDir = await sandbox.getWorkDir();
      const projectRoot = project.settings.projectRoot
        ? `${workDir}/project/${project.settings.projectRoot}`
        : `${workDir}/project`;
      console.log("Project root (where dev server will run):", projectRoot);

      // Always create a new session on resume (old sessions are destroyed when sandbox stops)
      const devSessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(devSessionId);
      console.log("Created new dev session:", devSessionId);

      // Build dev command with environment variables
      const baseDevCommand = `cd ${projectRoot} && ${project.settings.devCommand}`;
      const devCommand = await buildDevCommandWithEnv(
        ctx,
        branch.projectId,
        baseDevCommand,
      );

      // Start dev server in session
      const devResult = await sandbox.process.executeSessionCommand(devSessionId, {
        command: devCommand,
        runAsync: true,
      });

      console.log("Dev server started in session:", devSessionId);

      // Store new session IDs
      if (devResult.cmdId) {
        await ctx.runMutation(api.branches.updateBranchDevServerSession, {
          branchId: args.branchId,
          devSessionId: devSessionId,
          devCommandId: devResult.cmdId,
        });
      }

      // Step 7: Get fresh preview link
      console.log("Getting preview link for port:", project.settings.port);
      const previewLink = await sandbox.getPreviewLink(project.settings.port);
      const domain = previewLink.url;
      const previewToken = previewLink.token;
      console.log("Sandbox domain:", domain);

      // Step 8: Update status back to "ready" with fresh preview URL
      await ctx.runMutation(api.branches.updateBranchSandboxReady, {
        branchId: args.branchId,
        sandboxId: branch.sandboxId,
        domain,
        previewToken,
      });

      // Step 9: Inject sandbox worker (needs to be restarted after resume)
      console.log("Injecting sandbox worker...");

      // Generate Clerk token for worker authentication
      const clerkUserId = identity.subject;
      if (!clerkUserId) {
        throw new Error("No Clerk user ID found in identity");
      }
      const clerkToken = await generateClerkTokenForConvex(
        clerkUserId,
        identity.orgId,
      );

      // Fetch secrets for worker
      let anthropicApiKey: string | undefined;
      let projectEnvVars: Record<string, string> | undefined;

      try {
        // Fetch org's Anthropic API key
        const orgApiKey = await ctx.runAction(
          api.settings.getAnthropicApiKeyDecrypted,
          { orgId: identity.orgId },
        );
        if (orgApiKey) {
          anthropicApiKey = orgApiKey;
          console.log("✓ Anthropic API key found for organization");
        } else if (process.env.ANTHROPIC_API_KEY) {
          anthropicApiKey = process.env.ANTHROPIC_API_KEY;
          console.log("✓ Using Anthropic API key from Convex environment");
        }

        // Fetch project environment variables
        const envVars = await ctx.runAction(api.variables.getAllDecrypted, {
          projectId: branch.projectId,
        });
        if (Object.keys(envVars).length > 0) {
          projectEnvVars = envVars;
          console.log(
            `✓ ${Object.keys(envVars).length} project environment variables loaded`,
          );
        }
      } catch (secretError) {
        console.warn("⚠️ Failed to load secrets, continuing without them:", secretError);
        if (process.env.ANTHROPIC_API_KEY) {
          anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        }
      }

      const convexUrl = process.env.CONVEX_URL;
      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: branch.sandboxId,
          convexUrl,
          branchId: args.branchId,
          clerkToken,
          anthropicApiKey,
          projectEnvVars,
          projectRoot,
        });

        if (!workerResult.success) {
          console.warn(
            "⚠️ Failed to inject worker, continuing without it:",
            workerResult.error,
          );
        } else {
          console.log("Sandbox worker injected successfully");

          // Store worker session IDs for monitoring
          if (workerResult.sessionId && workerResult.commandId) {
            await ctx.runMutation(api.branches.updateBranchWorkerSession, {
              branchId: args.branchId,
              workerSessionId: workerResult.sessionId,
              workerCommandId: workerResult.commandId,
            });
          }
        }
      }

      console.log("=== resumeSandbox action complete ===");

      return {
        sandboxId: branch.sandboxId,
        domain,
        status: "running",
      };
    } catch (error) {
      console.error("=== resumeSandbox action failed ===");
      console.error("Error:", error);

      // Update branch sandbox with error
      try {
        const branch = await ctx.runQuery(api.branches.getBranchById, {
          branchId: args.branchId,
        });
        if (branch) {
          await ctx.runMutation(api.branches.updateBranchSandboxError, {
            branchId: args.branchId,
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          });
        }
      } catch (updateError) {
        console.error("Failed to update sandbox error status:", updateError);
      }

      throw error;
    }
  },
});

// Action to get dev server logs
export const getDevServerLogs = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    success: v.boolean(),
    logs: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ success: boolean; logs: string; error?: string }> => {
    try {
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });

      if (!branch?.sandboxId) {
        throw new Error("No sandbox found");
      }

      if (!branch.devServer?.sessionId || !branch.devServer?.commandId) {
        return {
          success: true,
          logs: "Dev server session not found or not started yet.",
        };
      }

      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);

      // Get dev server logs from session
      const logsResponse = await sandbox.process.getSessionCommandLogs(
        branch.devServer.sessionId,
        branch.devServer.commandId,
      );

      const logs: string = logsResponse.output || "No logs available";

      return {
        success: true,
        logs,
      };
    } catch (error) {
      console.error("Failed to fetch dev server logs:", error);
      return {
        logs: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Action to "ping" the sandbox and ensure it's running
// This is the main orchestrator action that clients should call
// It determines what action to take based on current state
export const pingSandbox = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== pingSandbox action called ===");
    console.log("Branch ID:", args.branchId);

    // Get auth and verify branch ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }

    // Get current branch state
    const branch = await ctx.runQuery(api.branches.getBranchById, {
      branchId: args.branchId,
    });

    if (!branch) {
      throw new Error("Branch not found");
    }

    console.log("Current state:", {
      sandboxId: branch.sandboxId,
      sandboxStatus: branch.sandboxStatus,
    });

    // Decision tree: What action should we take?

    // Case 1: No sandbox exists yet - create one
    if (!branch.sandboxId) {
      console.log("No sandbox exists, delegating to startSandbox");
      return await ctx.runAction(api.sandboxActions.startSandbox, {
        branchId: args.branchId,
      });
    }

    // Case 2: Sandbox is archived - needs full restart
    if (branch.sandboxStatus === "archived") {
      console.log("Sandbox is archived, delegating to retrySandbox");
      return await ctx.runAction(api.sandboxActions.retrySandbox, {
        branchId: args.branchId,
      });
    }

    // Case 3: Sandbox is stopped - just resume it
    if (branch.sandboxStatus === "stopped") {
      console.log("Sandbox is stopped, delegating to resumeSandbox");
      return await ctx.runAction(api.sandboxActions.resumeSandbox, {
        branchId: args.branchId,
      });
    }

    // Case 4: Sandbox is already running - return current state
    if (branch.sandboxStatus === "running") {
      console.log("Sandbox is already running, returning current state");
      return {
        sandboxId: branch.sandboxId,
        domain: branch.sandboxDomain || "",
        status: "running",
      };
    }

    // Case 5: Sandbox is being created or in an error state
    if (branch.sandboxStatus === "provisioning") {
      console.log("Sandbox is being created, returning current state");
      return {
        sandboxId: branch.sandboxId,
        domain: branch.sandboxDomain || "",
        status: "creating",
      };
    }

    if (branch.sandboxStatus === "error") {
      console.log("Sandbox is in error state, delegating to retrySandbox");
      return await ctx.runAction(api.sandboxActions.retrySandbox, {
        branchId: args.branchId,
      });
    }

    // Fallback: Something unexpected, try to resume
    console.warn("Unexpected sandbox state, attempting resume");
    return await ctx.runAction(api.sandboxActions.resumeSandbox, {
      branchId: args.branchId,
    });
  },
});

// Internal action to delete a sandbox (called when deleting a branch)
export const deleteSandbox = internalAction({
  args: {
    sandboxId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args: { sandboxId: string },
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("=== deleteSandbox action called ===");
    console.log("Sandbox ID:", args.sandboxId);

    try {
      // Initialize Daytona SDK
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      // Get the sandbox
      const sandbox = await daytona.get(args.sandboxId);
      console.log("Found sandbox:", args.sandboxId);

      // Delete the sandbox
      await daytona.delete(sandbox);
      console.log("Sandbox deleted successfully");

      return { success: true };
    } catch (error) {
      console.error("Failed to delete sandbox:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
