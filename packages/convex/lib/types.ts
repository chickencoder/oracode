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
  branchId: string;
  clerkToken: string;
  anthropicApiKey?: string; // Decrypted Anthropic API key from org settings
  projectEnvVars?: Record<string, string>; // Decrypted project environment variables
  projectRoot?: string; // Full path to project root directory (e.g., /home/oracode/project/apps/frontend)
}

export interface ServiceResult {
  success: boolean;
  error?: string;
  sessionId?: string; // Daytona session ID
  commandId?: string; // Command ID within session
}
