"use node";

import { createAppAuth } from "@octokit/auth-app";

/**
 * Format GitHub App private key from environment variable
 * Handles keys that are stored on a single line
 */
export function formatPrivateKey(privateKey: string): string {
  // If already formatted with newlines, return as-is
  if (privateKey.includes("\n")) {
    return privateKey;
  }

  // Format single-line key
  let formattedKey = privateKey
    .replace("-----BEGIN PRIVATE KEY----- ", "-----BEGIN PRIVATE KEY-----\n")
    .replace(" -----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----")
    .replace(/(.{64})/g, "$1\n");

  // Clean up double newlines
  formattedKey = formattedKey.replace(/\n\n/g, "\n").trim();

  return formattedKey;
}

/**
 * Generate a GitHub App JWT token for API authentication
 */
export async function generateGitHubJWT(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials not configured");
  }

  const formattedKey = formatPrivateKey(privateKey);

  // Create auth instance without installation ID to get JWT
  const auth = createAppAuth({
    appId: parseInt(appId),
    privateKey: formattedKey,
  });

  // Get JWT token
  const { token } = await auth({ type: "app" });
  return token;
}

/**
 * Generate a GitHub App installation token for accessing repositories
 */
export async function generateGitHubInstallationToken(
  installationId: number,
): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials not configured");
  }

  const formattedKey = formatPrivateKey(privateKey);

  // Create auth instance
  const auth = createAppAuth({
    appId: parseInt(appId),
    privateKey: formattedKey,
    installationId,
  });

  // Get installation access token
  const { token } = await auth({ type: "installation" });
  return token;
}

/**
 * Get repository clone URL and default branch from GitHub API
 */
export async function getRepositoryCloneUrl(
  githubToken: string,
  repoId: number,
): Promise<{ cloneUrl: string; defaultBranch: string }> {
  const response = await fetch(`https://api.github.com/repositories/${repoId}`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repository: ${response.status} ${response.statusText}`,
    );
  }

  const repo = await response.json();
  return {
    cloneUrl: repo.clone_url as string,
    defaultBranch: repo.default_branch as string,
  };
}
