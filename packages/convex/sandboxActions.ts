"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { Daytona } from "@daytonaio/sdk";
import ms from "ms";
import {
  generateGitHubInstallationToken,
  getRepositoryCloneUrl,
} from "./lib/githubAuth";
import { injectWorkerIntoSandbox } from "./lib/sandbox";
import { generateClerkTokenForConvex } from "./lib/clerkAuth";
import { buildOracodeImage } from "./lib/daytonaImage";

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
        if (branch.sandboxStatus === "creating") {
          throw new Error(
            "A sandbox is already being created for this branch. Please wait.",
          );
        }

        // If ready and started, return existing
        if (
          branch.sandboxStatus === "ready" &&
          branch.sandboxState === "started"
        ) {
          console.log("Returning existing ready sandbox");
          return {
            sandboxId: branch.sandboxId!,
            domain: branch.sandboxDomain!,
            status: "ready",
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

      // Wait for sandbox to be ready using SDK method
      console.log("Waiting for sandbox to be ready...");
      await sandbox.waitUntilStarted(0); // 0 = wait indefinitely
      console.log("Sandbox is ready!");

      // Step 10: Configure auto-stop interval (10 minutes)
      console.log("Configuring 10-minute auto-stop interval");
      await sandbox.setAutostopInterval(10);
      console.log("Auto-stop configured");

      // Step 11: Store sandboxId and state
      await ctx.runMutation(api.branches.updateBranchSandbox, {
        branchId: args.branchId,
        sandboxId: sandboxId,
      });
      await ctx.runMutation(api.branches.updateBranchSandboxState, {
        branchId: args.branchId,
        state: "started",
      });
      console.log("Stored sandbox ID and state");

      // Step 12: Get working directory
      // (pnpm + Claude SDK are pre-installed in the declarative image)
      const workDir = await sandbox.getWorkDir();
      console.log("Working directory:", workDir);

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
        `${workDir}/project`,
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

      // Build dev command with environment variables
      let devCommand = `cd ${workDir}/project && ${project.settings.devCommand}`;
      if (projectEnvVars && Object.keys(projectEnvVars).length > 0) {
        const { buildEnvExports } = await import("./lib/workerBundle");
        const envExports = buildEnvExports(projectEnvVars);
        devCommand = `${envExports} && ${devCommand}`;
        console.log(`Dev server will run with ${Object.keys(projectEnvVars).length} environment variables`);
      }

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
      const domain = previewLink.url;
      const previewToken = previewLink.token;
      console.log("Sandbox domain:", domain);
      console.log("Preview token:", previewToken ? "present" : "none");

      // Store domain and token in branch
      await ctx.runMutation(api.branches.updateBranchSandboxDomain, {
        branchId: args.branchId,
        domain,
        previewToken,
      });
      console.log("Stored sandbox domain and token");

      // Step 19: Install Claude Code CLI (required by Claude Agent SDK)
      console.log("Installing Claude Code CLI...");
      const claudeInstall = await sandbox.process.executeCommand(
        "npm install -g @anthropic-ai/claude-code 2>&1",
        `${workDir}/project`,
      );

      if (claudeInstall.exitCode !== 0) {
        console.warn(
          "⚠️ Claude Code CLI installation failed:",
          claudeInstall.result,
        );
      } else {
        console.log("✓ Claude Code CLI installed successfully");
      }

      // Step 20: Inject sandbox worker
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
        sandboxId: sandboxId, // Fixed: use stored sandboxId not sandbox.id
        domain,
        status: "ready",
      };
    } catch (error) {
      console.error("=== startSandbox action failed ===");
      console.error("Error:", error);

      // Try to update branch sandbox with error
      try {
        const branch = await ctx.runQuery(api.branches.getBranchById, {
          branchId: args.branchId,
        });
        if (branch && branch.sandboxStatus === "creating") {
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

// Action to restart an existing sandbox (stopped/archived/errored)
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

      console.log("Restarting sandbox:", branch.sandboxId);

      // Step 3: Get project settings
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: branch.projectId,
      });
      if (!project) {
        throw new Error("Project not found");
      }

      // Step 4: Reconnect to existing Sandbox
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "us") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);
      console.log("Reconnected to sandbox");

      // Step 5: Update status to "creating" (restarting)
      await ctx.runMutation(api.branches.initBranchSandbox, {
        branchId: args.branchId,
      });

      // Step 6: Start the sandbox
      console.log("Starting sandbox...");
      await sandbox.start();
      await sandbox.waitUntilStarted(0);
      console.log("Sandbox started successfully");

      // Update state to started
      await ctx.runMutation(api.branches.updateBranchSandboxState, {
        branchId: args.branchId,
        state: "started",
      });

      // Step 7: Get working directory
      const workDir = await sandbox.getWorkDir();
      console.log("Working directory:", workDir);

      // Step 8: Update stage to "installing"
      await ctx.runMutation(api.branches.updateBranchSandboxStage, {
        branchId: args.branchId,
        stage: "installing",
      });

      // Step 9: Run install command
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.process.executeCommand(
        project.settings.installCommand,
        `${workDir}/project`,
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Install command failed: ${installResult.result}`);
      }
      console.log("Install command completed successfully");

      // Step 10: Update stage to "starting"
      await ctx.runMutation(api.branches.updateBranchSandboxStage, {
        branchId: args.branchId,
        stage: "starting",
      });

      // Step 11: Start dev server in session (if not already running)
      console.log("Starting dev server:", project.settings.devCommand);

      // Create or reuse dev session
      const devSessionId = branch.devSessionId || `dev-server-${Date.now()}`;

      // Only create session if it doesn't exist
      if (!branch.devSessionId) {
        await sandbox.process.createSession(devSessionId);
      }

      const devResult = await sandbox.process.executeSessionCommand(
        devSessionId,
        {
          command: `cd ${workDir}/project && ${project.settings.devCommand}`,
          runAsync: true,
        },
      );

      console.log("Dev server started in session:", devSessionId);
      console.log("Command ID:", devResult.cmdId);

      // Store session IDs
      if (devResult.cmdId) {
        await ctx.runMutation(api.branches.updateBranchDevServerSession, {
          branchId: args.branchId,
          devSessionId: devSessionId,
          devCommandId: devResult.cmdId,
        });
      }

      // Step 12: Get domain using preview link API
      console.log("Getting preview link for port:", project.settings.port);
      const previewLink = await sandbox.getPreviewLink(project.settings.port);
      const domain = previewLink.url;
      const previewToken = previewLink.token;
      console.log("Sandbox domain:", domain);
      console.log("Preview token:", previewToken ? "present" : "none");

      // Step 13: Update status back to "ready" and clear error
      await ctx.runMutation(api.branches.updateBranchSandboxReady, {
        branchId: args.branchId,
        sandboxId: branch.sandboxId,
        domain,
        previewToken,
      });

      console.log("=== restartSandbox action complete ===");

      return {
        sandboxId: branch.sandboxId,
        domain,
        status: "ready",
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

// Action to get worker logs
export const getWorkerLogs = action({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.object({
    logs: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args: { branchId: Id<"branches"> },
  ): Promise<{ logs: string; success: boolean; error?: string }> => {
    console.log("=== getWorkerLogs action called ===");

    try {
      // Get branch with session IDs
      const branch = await ctx.runQuery(api.branches.getBranchById, {
        branchId: args.branchId,
      });

      if (!branch) {
        throw new Error("Branch not found");
      }

      if (!branch.sandboxId) {
        throw new Error("No sandbox found for this branch");
      }

      if (!branch.workerSessionId || !branch.workerCommandId) {
        throw new Error("No worker session found for this branch");
      }

      // Connect to Daytona
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
        target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
      });

      const sandbox = await daytona.get(branch.sandboxId);

      // Fetch worker logs from Daytona session
      const logsResponse = await sandbox.process.getSessionCommandLogs(
        branch.workerSessionId,
        branch.workerCommandId,
      );

      // Combine stdout and stderr
      const combinedLogs = [
        logsResponse.stdout ? `[STDOUT]\n${logsResponse.stdout}` : "",
        logsResponse.stderr ? `[STDERR]\n${logsResponse.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        logs: combinedLogs || logsResponse.output || "(no output)",
        success: true,
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
