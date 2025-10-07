export interface CommandResult {
  success: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
  command: string;
}

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export interface WorkerOptions {
  sandboxId: string;
  convexUrl: string;
  sessionId: string;
  clerkToken: string;
  r2Config?: R2Config;
}

export interface ServiceResult {
  success: boolean;
  error?: string;
}
