export interface CommandResult {
  success: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
  command: string;
}

export interface WorkerOptions {
  sandboxId: string;
  convexUrl: string;
  sessionId: string;
  clerkToken: string;
}

export interface ServiceResult {
  success: boolean;
  error?: string;
  sessionId?: string; // Daytona session ID
  commandId?: string; // Command ID within session
}
