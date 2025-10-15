/**
 * Escapes a value for safe use in a shell double-quoted string.
 * Handles: $, `, ", \, and newlines
 */
export function escapeShellValue(value: string): string {
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
