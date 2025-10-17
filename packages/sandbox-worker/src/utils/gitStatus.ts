import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";

const execAsync = promisify(exec);

export interface GitStatus {
  currentBranch: string;
  headCommit: string;
  hasUncommittedChanges: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  deleted: string[];
}

/**
 * Capture current git status by running git commands
 * Returns null if git commands fail (e.g., not a git repo)
 */
export async function captureGitStatus(): Promise<GitStatus | null> {
  try {
    // Get current branch name
    const { stdout: branchOutput } = await execAsync(
      "git rev-parse --abbrev-ref HEAD",
    );
    const currentBranch = branchOutput.trim();

    // Get HEAD commit SHA
    const { stdout: commitOutput } = await execAsync("git rev-parse HEAD");
    const headCommit = commitOutput.trim();

    // Get git status in porcelain format (easier to parse)
    const { stdout: statusOutput } = await execAsync("git status --porcelain");

    // Parse status output
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const deleted: string[] = [];

    const lines = statusOutput.split("\n").filter((line) => line.length > 0);

    for (const line of lines) {
      // Porcelain format: XY filename
      // X = index status, Y = working tree status
      const indexStatus = line[0];
      const workingStatus = line[1];
      const filename = line.substring(3).trim();

      // Index (staged) changes
      if (indexStatus === "A" || indexStatus === "M" || indexStatus === "D") {
        staged.push(filename);
      }

      // Working tree (unstaged) changes
      if (workingStatus === "M") {
        modified.push(filename);
      } else if (workingStatus === "D") {
        deleted.push(filename);
      }

      // Untracked files
      if (indexStatus === "?" && workingStatus === "?") {
        untracked.push(filename);
      }
    }

    const hasUncommittedChanges =
      staged.length > 0 ||
      modified.length > 0 ||
      untracked.length > 0 ||
      deleted.length > 0;

    return {
      currentBranch,
      headCommit,
      hasUncommittedChanges,
      staged,
      modified,
      untracked,
      deleted,
    };
  } catch (error) {
    logger.error("Failed to capture git status", error as Error);
    return null;
  }
}
