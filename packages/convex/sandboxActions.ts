"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import {
  generateGitHubInstallationToken,
  getRepositoryCloneUrl,
} from "./lib/github_auth";
import { injectWorkerIntoSandbox } from "./lib/sandbox";
import { generateClerkTokenForConvex } from "./lib/clerk_auth";

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

      // Step 2: Check for existing sandbox
      const existingSandbox = await ctx.runQuery(
        api.sandboxes.getSandboxBySession,
        {
          sessionId: args.sessionId,
        },
      );

      console.log("Existing sandbox:", existingSandbox);

      // Step 3: Handle existing sandbox scenarios
      if (existingSandbox) {
        // If already creating, return error to prevent duplicates
        if (existingSandbox.status === "creating") {
          throw new Error(
            "A sandbox is already being created for this session. Please wait.",
          );
        }

        // If ready and not timed out, return existing
        if (existingSandbox.status === "ready" && !existingSandbox.isTimedOut) {
          console.log("Returning existing ready sandbox");
          return {
            sandboxId: existingSandbox.sandboxId,
            domain: existingSandbox.domain,
            status: "ready",
          };
        }

        console.log(
          "Existing sandbox is timed out or errored, will create new one",
        );
      }

      // Step 4: Get session, project, and GitHub installation details
      const session = await ctx.runQuery(api.sessions.getSessionById, {
        sessionId: args.sessionId,
      });
      if (!session) {
        throw new Error("Session not found");
      }

      // Get project via a query since actions can't access ctx.db
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

      // Step 5: Generate GitHub token and get repo URL
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

      // Step 6: Create sandbox record with "creating" status
      const timeoutDuration = ms("1h"); // 1 hour in ms
      console.log("Creating sandbox record with timeout:", timeoutDuration);

      const sandboxRecordId = await ctx.runMutation(
        api.sandboxes.createSandbox,
        {
          sessionId: args.sessionId,
          timeoutDuration,
        },
      );

      console.log("Created sandbox record:", sandboxRecordId);

      // Step 7: Update stage to "provisioning"
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: sandboxRecordId,
        stage: "provisioning",
      });

      // Step 8: Create Vercel Sandbox
      console.log("Creating Vercel Sandbox...");
      const sandbox = await Sandbox.create({
        teamId: process.env.VERCEL_TEAM_ID!,
        projectId: process.env.VERCEL_PROJECT_ID!,
        token: process.env.VERCEL_TOKEN!,
        source: {
          type: "git",
          url: cloneUrl,
          username: "x-access-token", // GitHub convention for token auth
          password: githubToken,
        },
        resources: { vcpus: 4 },
        timeout: timeoutDuration,
        ports: [project.settings.port],
        runtime: "node22",
      });

      console.log("Vercel Sandbox created:", sandbox.sandboxId);

      // Step 9: Get domain immediately (port is exposed at creation time)
      const domain = sandbox.domain(project.settings.port);
      console.log("Sandbox domain:", domain);

      // Step 10: Store sandboxId and domain
      await ctx.runMutation(api.sandboxes.updateSandboxReady, {
        id: sandboxRecordId,
        sandboxId: sandbox.sandboxId,
        domain,
      });
      console.log("Stored sandbox ID and domain");

      // Step 10: Update stage to "cloning" (git clone happens during Sandbox.create)
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: sandboxRecordId,
        stage: "cloning",
      });

      // Step 11: Update stage to "installing"
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: sandboxRecordId,
        stage: "installing",
      });

      // Step 12: Run install command
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.runCommand("sh", [
        "-c",
        project.settings.installCommand,
      ]);

      // Wait for command to complete
      const installExitCode = await installResult.exitCode;
      if (installExitCode !== 0) {
        const stderr = await installResult.stderr();
        throw new Error(`Install command failed: ${stderr}`);
      }
      console.log("Install command completed successfully");

      // Step 13: Update stage to "starting"
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: sandboxRecordId,
        stage: "starting",
      });

      // Step 14: Start dev server in background with nohup and log to file
      console.log("Starting dev server:", project.settings.devCommand);
      const devCommandWithLogging = `nohup ${project.settings.devCommand} > /tmp/dev-server.log 2>&1 & echo $!`;

      const startResult = await sandbox.runCommand("sh", ["-c", devCommandWithLogging]);
      const pid = (await startResult.stdout()).trim();
      console.log("Dev server started with PID:", pid);

      // Wait a moment for the server to initialize
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if process is still running and get initial logs
      const checkResult = await sandbox.runCommand("sh", [
        "-c",
        `ps -p ${pid} > /dev/null && echo "running" || echo "stopped"`,
      ]);
      const isRunning = (await checkResult.stdout()).trim() === "running";
      console.log("Dev server status:", isRunning ? "running" : "stopped");

      // Get initial log output to diagnose any startup issues
      const logResult = await sandbox.runCommand("sh", ["-c", "head -100 /tmp/dev-server.log"]);
      const logs = await logResult.stdout();
      console.log("[DEV SERVER LOGS]:", logs);

      if (!isRunning) {
        throw new Error(`Dev server failed to start. Logs: ${logs}`);
      }

      // Step 15: Inject sandbox worker
      console.log("Injecting sandbox worker...");
      const convexUrl = process.env.CONVEX_URL;

      if (!convexUrl) {
        console.warn("⚠️ No CONVEX_URL found, skipping worker injection");
      } else {
        const workerResult = await injectWorkerIntoSandbox(sandbox, {
          sandboxId: sandbox.sandboxId,
          convexUrl,
          sessionId: args.sessionId,
          clerkToken,
          r2Config: process.env.R2_ENDPOINT
            ? {
                endpoint: process.env.R2_ENDPOINT,
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
                bucketName: process.env.R2_BUCKET_NAME!,
              }
            : undefined,
        });

        if (!workerResult.success) {
          console.warn(
            "⚠️ Failed to inject worker, continuing without it:",
            workerResult.error,
          );
        } else {
          console.log("Sandbox worker injected successfully");
        }
      }

      // Step 16: Clear loading stage (sandbox is ready)
      await ctx.runMutation(api.sandboxes.updateSandboxReady, {
        id: sandboxRecordId,
        sandboxId: sandbox.sandboxId,
        domain,
      });

      console.log("=== startSandbox action complete ===");

      return {
        sandboxId: sandbox.sandboxId,
        domain,
        status: "ready",
      };
    } catch (error) {
      console.error("=== startSandbox action failed ===");
      console.error("Error:", error);

      // Try to update sandbox record with error if it was created
      try {
        const existingSandbox = await ctx.runQuery(
          api.sandboxes.getSandboxBySession,
          {
            sessionId: args.sessionId,
          },
        );
        if (existingSandbox && existingSandbox.status === "creating") {
          await ctx.runMutation(api.sandboxes.updateSandboxError, {
            id: existingSandbox._id,
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

// Action to retry a failed sandbox (reconnects to existing VM)
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
    console.log("=== retrySandbox action called ===");
    console.log("Session ID:", args.sessionId);

    try {
      // Step 1: Get auth and verify session ownership
      const identity = await ctx.auth.getUserIdentity();
      if (!identity?.orgId || typeof identity.orgId !== "string") {
        throw new Error("User must be authenticated with an organization");
      }

      // Step 2: Get existing sandbox
      const existingSandbox = await ctx.runQuery(
        api.sandboxes.getSandboxBySession,
        {
          sessionId: args.sessionId,
        },
      );

      if (!existingSandbox) {
        throw new Error("No sandbox found for this session");
      }

      if (!existingSandbox.sandboxId) {
        throw new Error("Sandbox ID not found - cannot reconnect");
      }

      console.log("Reconnecting to sandbox:", existingSandbox.sandboxId);

      // Step 3: Get project settings
      const session = await ctx.runQuery(api.sessions.getSessionById, {
        sessionId: args.sessionId,
      });
      if (!session) {
        throw new Error("Session not found");
      }

      const project = await ctx.runQuery(api.projects.getProjectById, {
        projectId: session.projectId,
      });
      if (!project) {
        throw new Error("Project not found");
      }

      // Step 4: Reconnect to existing Vercel Sandbox
      const sandbox = await Sandbox.get({
        sandboxId: existingSandbox.sandboxId,
        token: process.env.VERCEL_TOKEN!,
      });

      console.log("Reconnected to sandbox");

      // Step 5: Update status to "creating" (retrying)
      await ctx.runMutation(api.sandboxes.updateSandboxCreating, {
        id: existingSandbox._id,
      });

      // Step 6: Update stage to "installing"
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: existingSandbox._id,
        stage: "installing",
      });

      // Step 7: Run install command
      console.log("Running install command:", project.settings.installCommand);
      const installResult = await sandbox.runCommand("sh", [
        "-c",
        project.settings.installCommand,
      ]);

      const installExitCode = await installResult.exitCode;
      if (installExitCode !== 0) {
        const stderr = await installResult.stderr();
        throw new Error(`Install command failed: ${stderr}`);
      }
      console.log("Install command completed successfully");

      // Step 8: Update stage to "starting"
      await ctx.runMutation(api.sandboxes.updateSandboxStage, {
        id: existingSandbox._id,
        stage: "starting",
      });

      // Step 9: Start dev server in background with nohup and log to file
      console.log("Starting dev server:", project.settings.devCommand);
      const devCommandWithLogging = `nohup ${project.settings.devCommand} > /tmp/dev-server.log 2>&1 & echo $!`;

      const startResult = await sandbox.runCommand("sh", ["-c", devCommandWithLogging]);
      const pid = (await startResult.stdout()).trim();
      console.log("Dev server started with PID:", pid);

      // Wait a moment for the server to initialize
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if process is still running and get initial logs
      const checkResult = await sandbox.runCommand("sh", [
        "-c",
        `ps -p ${pid} > /dev/null && echo "running" || echo "stopped"`,
      ]);
      const isRunning = (await checkResult.stdout()).trim() === "running";
      console.log("Dev server status:", isRunning ? "running" : "stopped");

      // Get initial log output to diagnose any startup issues
      const logResult = await sandbox.runCommand("sh", ["-c", "head -100 /tmp/dev-server.log"]);
      const logs = await logResult.stdout();
      console.log("[DEV SERVER LOGS]:", logs);

      if (!isRunning) {
        throw new Error(`Dev server failed to start. Logs: ${logs}`);
      }

      // Step 10: Update status back to "ready" (clears loading stage)
      await ctx.runMutation(api.sandboxes.updateSandboxReady, {
        id: existingSandbox._id,
        sandboxId: existingSandbox.sandboxId,
        domain: existingSandbox.domain,
      });

      console.log("=== retrySandbox action complete ===");

      return {
        sandboxId: existingSandbox.sandboxId,
        domain: existingSandbox.domain,
        status: "ready",
      };
    } catch (error) {
      console.error("=== retrySandbox action failed ===");
      console.error("Error:", error);

      // Update sandbox record with error
      try {
        const existingSandbox = await ctx.runQuery(
          api.sandboxes.getSandboxBySession,
          {
            sessionId: args.sessionId,
          },
        );
        if (existingSandbox) {
          await ctx.runMutation(api.sandboxes.updateSandboxError, {
            id: existingSandbox._id,
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
