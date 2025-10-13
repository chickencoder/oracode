"use node";

import { WORKER_BUNDLE_CONTENT, WORKER_BUNDLE_SIZE } from "./workerBundleContent";

interface WorkerBundle {
  content: string;
  filename: string;
  size: number;
}

export function getBundle(): WorkerBundle {
  return {
    content: WORKER_BUNDLE_CONTENT,
    filename: "sandbox-worker.js",
    size: WORKER_BUNDLE_SIZE,
  };
}

export function getWorkerEnv(options: {
  sandboxId: string;
  convexUrl: string;
  branchId: string;
  clerkToken: string;
  anthropicApiKey?: string;
  projectEnvVars?: Record<string, string>;
}): Record<string, string> {
  // Base environment variables for the worker
  const baseEnv: Record<string, string> = {
    CONVEX_URL: options.convexUrl,
    SANDBOX_ID: options.sandboxId,
    BRANCH_ID: options.branchId,
    NODE_ENV: "production",
    ANTHROPIC_API_KEY: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    CLERK_TOKEN: options.clerkToken,
  };

  // Merge in project-specific environment variables
  if (options.projectEnvVars) {
    Object.assign(baseEnv, options.projectEnvVars);
  }

  return baseEnv;
}

/**
 * Escapes a value for safe use in a shell double-quoted string.
 * Handles: $, `, ", \, and newlines
 */
function escapeShellValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/"/g, '\\"')     // Escape double quotes
    .replace(/`/g, '\\`')     // Escape backticks
    .replace(/\$/g, '\\$')    // Escape dollar signs
    .replace(/\n/g, '\\n');   // Escape newlines
}

/**
 * Builds a shell command string with environment variable exports.
 * Properly escapes all values to prevent shell injection.
 */
export function buildEnvExports(envVars: Record<string, string>): string {
  return Object.entries(envVars)
    .map(([key, value]) => `export ${key}="${escapeShellValue(value)}"`)
    .join(" && ");
}

export function getStartCommand(envVars: Record<string, string>): string {
  const envExports = buildEnvExports(envVars);

  // Run worker directly in session (no nohup, no redirection)
  // This allows Daytona session to capture stdout/stderr
  return `${envExports} && export NODE_PATH=$(npm root -g):$NODE_PATH && node /tmp/sandbox-worker.js`;
}

export const STOP_COMMAND =
  "if [ -f /tmp/worker.pid ]; then kill $(cat /tmp/worker.pid) 2>/dev/null; rm -f /tmp/worker.pid; fi";

export const STATUS_COMMAND =
  "if [ -f /tmp/worker.pid ] && kill -0 $(cat /tmp/worker.pid) 2>/dev/null; then echo 'running'; else echo 'stopped'; fi";

export const LOGS_COMMAND =
  "if [ -f /tmp/worker.log ]; then tail -n 50 /tmp/worker.log; else echo 'No worker logs found'; fi";
