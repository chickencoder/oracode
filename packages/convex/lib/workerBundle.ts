"use node";

import { WORKER_BUNDLE_CONTENT, WORKER_BUNDLE_SIZE } from "./workerBundleContent";

interface WorkerBundle {
  content: string;
  filename: string;
  size: number;
}

interface WorkerEnvironment {
  CONVEX_URL: string;
  SANDBOX_ID: string;
  SESSION_ID: string;
  NODE_ENV: string;
  ANTHROPIC_API_KEY: string;
  CLERK_TOKEN: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
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
  sessionId: string;
  clerkToken: string;
  r2Config?: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
}): WorkerEnvironment {
  const env: WorkerEnvironment = {
    CONVEX_URL: options.convexUrl,
    SANDBOX_ID: options.sandboxId,
    SESSION_ID: options.sessionId,
    NODE_ENV: "production",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    CLERK_TOKEN: options.clerkToken,
  };

  if (options.r2Config) {
    env.R2_ENDPOINT = options.r2Config.endpoint;
    env.R2_ACCESS_KEY_ID = options.r2Config.accessKeyId;
    env.R2_SECRET_ACCESS_KEY = options.r2Config.secretAccessKey;
    env.R2_BUCKET_NAME = options.r2Config.bucketName;
  }

  return env;
}

export function getStartCommand(envVars: WorkerEnvironment): string {
  const envExports = Object.entries(envVars)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join(" && ");

  return `${envExports} && export NODE_PATH=$(npm root -g):$NODE_PATH && (nohup node /tmp/sandbox-worker.js >/tmp/worker.log 2>&1 & echo $! > /tmp/worker.pid && echo "Worker started with PID $(cat /tmp/worker.pid)")`;
}

export const STOP_COMMAND =
  "if [ -f /tmp/worker.pid ]; then kill $(cat /tmp/worker.pid) 2>/dev/null; rm -f /tmp/worker.pid; fi";

export const STATUS_COMMAND =
  "if [ -f /tmp/worker.pid ] && kill -0 $(cat /tmp/worker.pid) 2>/dev/null; then echo 'running'; else echo 'stopped'; fi";

export const LOGS_COMMAND =
  "if [ -f /tmp/worker.log ]; then tail -n 50 /tmp/worker.log; else echo 'No worker logs found'; fi";
