/**
 * GitHub-related constants
 */

/**
 * Get GitHub avatar URL for a given username or organization
 */
export function getGitHubAvatarUrl(usernameOrOrg: string): string {
  return `https://github.com/${usernameOrOrg}.png`;
}

/**
 * Convert GitHub organization name to valid Clerk organization slug
 * Lowercases and replaces non-alphanumeric characters with hyphens
 */
export function normalizeOrgSlug(githubOrg: string): string {
  return githubOrg.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

/**
 * Chat-related constants
 */

export const MODELS = [
  { id: "sonnet-4.5", name: "Sonnet 4.5" },
  { id: "opus-4.1", name: "Opus 4.1" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const OPTIMISTIC_ASSISTANT_DELAY = 500;
