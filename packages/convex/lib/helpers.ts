/**
 * Shared helper functions for Convex backend
 */

/**
 * Convert GitHub organization name to valid Clerk organization slug
 * Lowercases and replaces non-alphanumeric characters with hyphens
 */
export function normalizeOrgSlug(githubOrg: string): string {
  return githubOrg.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

/**
 * Get GitHub avatar URL for a given username or organization
 * @param usernameOrOrg - GitHub username or organization slug
 * @param size - Avatar size in pixels (default: 40 for Retina displays)
 */
export function getGitHubAvatarUrl(usernameOrOrg: string, size: number = 40): string {
  return `https://github.com/${usernameOrOrg}.png?s=${size}`;
}
