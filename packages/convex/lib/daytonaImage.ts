"use node";

import { Image } from "@daytonaio/sdk";

/**
 * Builds the Oracode base image with pre-installed dependencies
 * This image includes:
 * - Essential utilities (curl, coreutils for sleep/etc)
 * - ripgrep (required by Claude Code)
 * - pnpm package manager
 * - Claude Code (installed via native installer to ~/.local/bin/claude)
 * - Claude Agent SDK and Anthropic SDK (installed globally via npm)
 * - Custom "oracode" user with home directory /home/oracode
 * - Working directory set to /home/oracode
 */
export function buildOracodeImage() {
  return Image.base("node:22-slim")
    .runCommands(
      // Install essential utilities and ripgrep (required by Claude Code)
      "apt-get update && apt-get install -y curl coreutils procps ripgrep strace && rm -rf /var/lib/apt/lists/*",
      "npm install -g pnpm@latest",
      // Install Claude Agent SDK, Claude Code, and Anthropic SDK globally via npm (latest versions)
      "npm install -g @anthropic-ai/claude-agent-sdk @anthropic-ai/claude-code @anthropic-ai/sdk",
      // Create oracode user with home directory
      "useradd -m -d /home/oracode -s /bin/bash oracode",
    )
    .dockerfileCommands(["USER oracode"])
    .workdir("/home/oracode");
}
