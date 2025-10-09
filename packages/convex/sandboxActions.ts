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

// Action to start a sandbox for a session
export const startSandbox = action({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { sessionId: Id<"sessions"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== startSandbox action called ===");
    console.log("Session ID:", args.sessionId);

    try {
      // Step 1: Get auth and verify session ownership
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
      const clerkToken = await generateClerkTokenForConvex(clerkUserId);

      // Step 2: Check for existing sandbox in session
      const session = await ctx.runQuery(api.sessions.getSessionById, {
        sessionId: args.sessionId,
      });
      if (!session) {
        throw new Error("Session not found");
      }

      console.log("Session sandbox status:", session.sandboxStatus);

      // Step 3: Handle existing sandbox scenarios
      if (session.sandboxStatus) {
        // If already creating, return error to prevent duplicates
        if (session.sandboxStatus === "creating") {
          throw new Error(
            "A sandbox is already being created for this session. Please wait.",
          );
        }

        // If ready and started, return existing
        if (
          session.sandboxStatus === "ready" &&
          session.sandboxState === "started"
        ) {
          console.log("Returning existing ready sandbox");
          return {
            sandboxId: session.sandboxId!,
            domain: session.sandboxDomain!,
            status: "ready",
          };
        }

        console.log(
          "Existing sandbox is stopped/archived or errored, will restart it",
        );
      }

      // Step 4: Initialize sandbox in session with "creating" status FIRST
      console.log("Initializing sandbox creation");

      await ctx.runMutation(api.sessions.initSessionSandbox, {
        sessionId: args.sessionId,
      });

      console.log("Session sandbox initialized");

      // Step 5: Update stage to "provisioning"
      await ctx.runMutation(api.sessions.updateSessionSandboxStage, {
        sessionId: args.sessionId,
        stage: "provisioning",
      });

      // Step 6: Get project and GitHub installation details
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: session.projectId,
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
        target: (process.env.DAYTONA_TARGET || "us") as "eu" | "us" | "asia",
      });

      // Step 9: Create Daytona Sandbox
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
      await ctx.runMutation(api.sessions.updateSessionSandbox, {
        sessionId: args.sessionId,
        sandboxId: sandboxId,
      });
      await ctx.runMutation(api.sessions.updateSessionSandboxState, {
        sessionId: args.sessionId,
        state: "started",
      });
      console.log("Stored sandbox ID and state");

      // Step 11: Get working directory
      // (pnpm + Claude SDK are pre-installed in the declarative image)
      const workDir = await sandbox.getWorkDir();
      console.log("Working directory:", workDir);

      // Step 12: Clone repository using Daytona's Git API
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

      // Step 13: Update stage to "installing"
      await ctx.runMutation(api.sessions.updateSessionSandboxStage, {
        sessionId: args.sessionId,
        stage: "installing",
      });

      // Step 13: Run install command
      // pnpm is pre-installed in the declarative image
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.process.executeCommand(
        `cd ${workDir}/project && ${project.settings.installCommand}`,
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

      // Step 16: Update stage to "starting"
      await ctx.runMutation(api.sessions.updateSessionSandboxStage, {
        sessionId: args.sessionId,
        stage: "starting",
      });

      // Step 17: Start dev server in Daytona session
      console.log(
        "Starting dev server in session:",
        project.settings.devCommand,
      );

      // Create a persistent session for the dev server
      const devSessionId = `dev-server-${Date.now()}`;
      await sandbox.process.createSession(devSessionId);

      // Execute dev command asynchronously in the session
      const devResult = await sandbox.process.executeSessionCommand(
        devSessionId,
        {
          command: `cd ${workDir}/project && ${project.settings.devCommand}`,
          runAsync: true, // Run in background
        },
      );

      console.log("Dev server started in session:", devSessionId);
      console.log("Command ID:", devResult.cmdId);

      // Store session ID in Convex for later monitoring
      if (devResult.cmdId) {
        await ctx.runMutation(api.sessions.updateSessionDevServerSession, {
          sessionId: args.sessionId,
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

      // Store domain and token in session
      await ctx.runMutation(api.sessions.updateSessionSandboxDomain, {
        sessionId: args.sessionId,
        domain,
        previewToken,
      });
      console.log("Stored sandbox domain and token");

      // Step 18: Inject sandbox worker
      console.log("Injecting sandbox worker...");
      const convexUrl = process.env.CONVEX_URL;

      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: sandboxId, // Fixed: use stored sandboxId not sandbox.id
          convexUrl,
          sessionId: args.sessionId,
          clerkToken,
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
            await ctx.runMutation(api.sessions.updateSessionWorkerSession, {
              sessionId: args.sessionId,
              workerSessionId: workerResult.sessionId,
              workerCommandId: workerResult.commandId,
            });
          }
        }
      }

      // Step 19: Clear loading stage (sandbox is ready)
      await ctx.runMutation(api.sessions.clearSessionSandboxLoadingStage, {
        sessionId: args.sessionId,
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

      // Try to update session sandbox with error
      try {
        const session = await ctx.runQuery(api.sessions.getSessionById, {
          sessionId: args.sessionId,
        });
        if (session && session.sandboxStatus === "creating") {
          await ctx.runMutation(api.sessions.updateSessionSandboxError, {
            sessionId: args.sessionId,
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
    sessionId: v.id("sessions"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { sessionId: Id<"sessions"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== restartSandbox action called ===");
    console.log("Session ID:", args.sessionId);

    try {
      // Step 1: Get auth and verify session ownership
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }

      // Step 2: Get existing sandbox from session
      const session = await ctx.runQuery(api.sessions.getSessionById, {
        sessionId: args.sessionId,
      });

      if (!session) {
        throw new Error("Session not found");
      }

      if (!session.sandboxId) {
        throw new Error("No sandbox found for this session");
      }

      console.log("Restarting sandbox:", session.sandboxId);

      // Step 3: Get project settings
      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: session.projectId,
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

      const sandbox = await daytona.get(session.sandboxId);
      console.log("Reconnected to sandbox");

      // Step 5: Update status to "creating" (restarting)
      await ctx.runMutation(api.sessions.initSessionSandbox, {
        sessionId: args.sessionId,
      });

      // Step 6: Start the sandbox
      console.log("Starting sandbox...");
      await sandbox.start();
      await sandbox.waitUntilStarted(0);
      console.log("Sandbox started successfully");

      // Update state to started
      await ctx.runMutation(api.sessions.updateSessionSandboxState, {
        sessionId: args.sessionId,
        state: "started",
      });

      // Step 7: Get working directory
      const workDir = await sandbox.getWorkDir();

      // Step 8: Update stage to "installing"
      await ctx.runMutation(api.sessions.updateSessionSandboxStage, {
        sessionId: args.sessionId,
        stage: "installing",
      });

      // Step 9: Run install command
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.process.executeCommand(
        `cd ${workDir}/project && ${project.settings.installCommand}`,
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Install command failed: ${installResult.result}`);
      }
      console.log("Install command completed successfully");

      // Step 10: Update stage to "starting"
      await ctx.runMutation(api.sessions.updateSessionSandboxStage, {
        sessionId: args.sessionId,
        stage: "starting",
      });

      // Step 11: Start dev server in session (if not already running)
      console.log("Starting dev server:", project.settings.devCommand);

      // Create or reuse dev session
      const devSessionId = session.devSessionId || `dev-server-${Date.now()}`;

      // Only create session if it doesn't exist
      if (!session.devSessionId) {
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
        await ctx.runMutation(api.sessions.updateSessionDevServerSession, {
          sessionId: args.sessionId,
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
      await ctx.runMutation(api.sessions.updateSessionSandboxReady, {
        sessionId: args.sessionId,
        sandboxId: session.sandboxId,
        domain,
        previewToken,
      });

      console.log("=== restartSandbox action complete ===");

      return {
        sandboxId: session.sandboxId,
        domain,
        status: "ready",
      };
    } catch (error) {
      console.error("=== restartSandbox action failed ===");
      console.error("Error:", error);

      // Update session sandbox with error
      try {
        const session = await ctx.runQuery(api.sessions.getSessionById, {
          sessionId: args.sessionId,
        });
        if (session) {
          await ctx.runMutation(api.sessions.updateSessionSandboxError, {
            sessionId: args.sessionId,
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
    sessionId: v.id("sessions"),
  },
  returns: v.object({
    sandboxId: v.string(),
    domain: v.string(),
    status: v.string(),
  }),
  handler: async (
    ctx,
    args: { sessionId: Id<"sessions"> },
  ): Promise<{ sandboxId: string; domain: string; status: string }> => {
    console.log("=== retrySandbox action called (delegating to restartSandbox) ===");

    // Simply delegate to restartSandbox - it handles all cases (stopped/archived/errored)
    return await ctx.runAction(api.sandboxActions.restartSandbox, {
      sessionId: args.sessionId,
    });
  },
});
