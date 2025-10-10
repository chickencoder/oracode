"use node";

import { Image } from "@daytonaio/sdk";

/**
 * Builds the Oracode base image with pre-installed dependencies
 * This image includes:
 * - pnpm package manager
 * - Claude Agent SDK and dependencies
 * - Working directory set to /home/daytona
 */
export function buildOracodeImage() {
  return Image.base("node:22-slim")
    .runCommands(
      "npm install -g pnpm@latest",
      "npm install -g @anthropic-ai/claude-agent-sdk @anthropic-ai/sdk"
    )
    .workdir("/home/daytona");
}
