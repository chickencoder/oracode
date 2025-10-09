"use node";

import { Daytona } from "@daytonaio/sdk";
import type { CommandResult, WorkerOptions, ServiceResult } from "./types";
import {
  getBundle,
  getWorkerEnv,
  getStartCommand,
} from "./workerBundle";

export async function runCommandInSandbox(
  sandbox: any,
  command: string,
  args: string[] = [],
): Promise<CommandResult> {
  try {
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;

    const result = await sandbox.process.executeCommand(fullCommand);

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.result || "",
      error: result.exitCode !== 0 ? result.result || "" : "",
      command: fullCommand,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Command execution failed";
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;
    return {
      success: false,
      error: errorMessage,
      command: fullCommand,
    };
  }
}

export async function injectWorkerIntoSandbox(
  sandbox: any,
  options: WorkerOptions,
): Promise<ServiceResult> {
  try {
    console.log("[injectWorker] Starting worker injection...");
    console.log("[injectWorker] Options:", {
      sandboxId: options.sandboxId,
      convexUrl: options.convexUrl,
      sessionId: options.sessionId,
      hasClerkToken: !!options.clerkToken,
    });

    const bundle = getBundle();
    console.log("[injectWorker] Bundle size:", bundle.content.length, "bytes");

    // Write worker bundle to sandbox
    console.log("[injectWorker] Uploading worker bundle to /tmp/sandbox-worker.js");
    const fileContent = Buffer.from(bundle.content, 'utf-8');
    await sandbox.fs.uploadFile(fileContent, "/tmp/sandbox-worker.js");
    console.log("[injectWorker] Worker bundle uploaded successfully");

    // Make it executable
    console.log("[injectWorker] Making worker executable");
    const chmodResult = await runCommandInSandbox(sandbox, "chmod", [
      "+x",
      "/tmp/sandbox-worker.js",
    ]);
    if (!chmodResult.success) {
      console.error("[injectWorker] Failed to chmod:", chmodResult.error);
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }
    console.log("[injectWorker] Worker is now executable");

    // Claude SDK is pre-installed in the declarative image
    console.log("[injectWorker] Using pre-installed Claude SDK from image");

    // Create persistent session for worker
    const workerSessionId = `sandbox-worker-${Date.now()}`;
    console.log("[injectWorker] Creating worker session:", workerSessionId);
    await sandbox.process.createSession(workerSessionId);
    console.log("[injectWorker] Worker session created");

    // Start worker with environment variables in session
    const envVars = getWorkerEnv(options);
    const startCommand = getStartCommand(envVars);
    console.log("[injectWorker] Start command:", startCommand);

    console.log("[injectWorker] Starting worker in background...");
    const workerResult = await sandbox.process.executeSessionCommand(workerSessionId, {
      command: startCommand,
      runAsync: true, // Run in background
    });

    console.log("[injectWorker] Worker started in session:", workerSessionId);
    console.log("[injectWorker] Worker command ID:", workerResult.cmdId);

    // Check initial logs to verify worker started
    if (workerResult.cmdId) {
      console.log("[injectWorker] Checking initial worker logs...");
      try {
        const logsResponse = await sandbox.process.getSessionCommandLogs(
          workerSessionId,
          workerResult.cmdId,
        );
        const logs = logsResponse.output || "";
        console.log("[injectWorker] Initial worker logs:", logs.substring(0, 500));

        if (logs.toLowerCase().includes("error")) {
          console.warn("[injectWorker] ⚠️ Detected errors in worker logs:", logs);
        }
      } catch (logError) {
        console.warn("[injectWorker] Could not fetch initial logs:", logError);
      }
    }

    console.log("[injectWorker] ✅ Worker injection completed successfully");
    return {
      success: true,
      sessionId: workerSessionId,
      commandId: workerResult.cmdId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[injectWorker] ❌ Worker injection failed:", errorMessage);
    console.error("[injectWorker] Error stack:", error instanceof Error ? error.stack : "N/A");
    return {
      success: false,
      error: errorMessage,
    };
  }
}
