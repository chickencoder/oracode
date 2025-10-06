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
