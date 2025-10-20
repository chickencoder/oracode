"use node";
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
    const bundle = getBundle();

    // Write worker bundle to sandbox
    const fileContent = Buffer.from(bundle.content, 'utf-8');
    await sandbox.fs.uploadFile(fileContent, "/tmp/sandbox-worker.js");

    // Make it executable
    const chmodResult = await runCommandInSandbox(sandbox, "chmod", [
      "+x",
      "/tmp/sandbox-worker.js",
    ]);
    if (!chmodResult.success) {
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }

    // Create persistent session for worker
    const workerSessionId = `sandbox-worker-${Date.now()}`;
    await sandbox.process.createSession(workerSessionId);

    // Start worker with environment variables in session
    const envVars = getWorkerEnv(options);
    const startCommand = getStartCommand(envVars);

    const workerResult = await sandbox.process.executeSessionCommand(workerSessionId, {
      command: startCommand,
      runAsync: true, // Run in background
    });

    return {
      success: true,
      sessionId: workerSessionId,
      commandId: workerResult.cmdId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
