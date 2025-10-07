"use node";

import { Sandbox } from "@vercel/sandbox";
import {
  getBundle,
  getWorkerEnv,
  getStartCommand,
} from "./worker_bundle";
import type { CommandResult, WorkerOptions, ServiceResult } from "./types";

export async function runCommandInSandbox(
  sandbox: Sandbox,
  command: string,
  args: string[] = [],
): Promise<CommandResult> {
  try {
    const result = await sandbox.runCommand(command, args);

    for await (const log of result.logs()) {
      console.log("LOG", log);
    }

    // Handle stdout and stderr properly
    let stdout = "";
    let stderr = "";

    try {
      stdout = await (result.stdout as () => Promise<string>)();
    } catch (error) {
      console.warn("Failed to read stdout:", error);
    }

    try {
      stderr = await (result.stderr as () => Promise<string>)();
    } catch (error) {
      console.warn("Failed to read stderr:", error);
    }

    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: stdout,
      error: stderr,
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
  sandbox: Sandbox,
  options: WorkerOptions,
): Promise<ServiceResult> {
  try {
    const bundle = getBundle();

    await sandbox.writeFiles([
      {
        path: "/tmp/sandbox-worker.js",
        content: Buffer.from(bundle.content),
      },
    ]);

    const chmodResult = await runCommandInSandbox(sandbox, "chmod", [
      "+x",
      "/tmp/sandbox-worker.js",
    ]);
    if (!chmodResult.success) {
      throw new Error(`Failed to make worker executable: ${chmodResult.error}`);
    }

    const installResult = await runCommandInSandbox(sandbox, "npm", [
      "install",
      "-g",
      "@anthropic-ai/claude-agent-sdk",
      "@anthropic-ai/sdk",
    ]);
    if (!installResult.success) {
      throw new Error(
        `Failed to install dependencies: ${installResult.error}`,
      );
    }

    const envVars = getWorkerEnv(options);
    const startCommand = getStartCommand(envVars);

    const startResult = await runCommandInSandbox(sandbox, "bash", [
      "-c",
      startCommand,
    ]);

    if (!startResult.success) {
      throw new Error(`Failed to start worker: ${startResult.error}`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
