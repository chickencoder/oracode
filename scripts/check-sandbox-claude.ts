#!/usr/bin/env node
/**
 * Check if claude-code is installed in a Daytona sandbox
 */

import { Daytona } from "@daytonaio/sdk";

async function checkClaudeInstallation(sandboxId: string) {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY!,
    apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
    target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
  });

  const sandbox = await daytona.get(sandboxId);

  console.log("Checking Claude Code installation...\n");

  // Check if claude-code is installed
  const claudeCheck = await sandbox.process.executeCommand("which claude-code");
  console.log("1. claude-code binary location:");
  console.log(claudeCheck.result || "NOT FOUND");
  console.log(`Exit code: ${claudeCheck.exitCode}\n`);

  // Check npm global packages
  const npmList = await sandbox.process.executeCommand("npm list -g --depth=0 2>&1");
  console.log("2. Global npm packages:");
  console.log(npmList.result);
  console.log();

  // Try to run claude-code --version
  const versionCheck = await sandbox.process.executeCommand("claude-code --version 2>&1");
  console.log("3. claude-code --version:");
  console.log(versionCheck.result || "(failed)");
  console.log(`Exit code: ${versionCheck.exitCode}\n`);
}

const sandboxId = process.argv[2];
if (!sandboxId) {
  console.error("Usage: tsx scripts/check-sandbox-claude.ts <sandbox-id>");
  process.exit(1);
}

checkClaudeInstallation(sandboxId).catch(console.error);
