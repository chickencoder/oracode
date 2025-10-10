#!/usr/bin/env node
/**
 * Diagnostic script to test network connectivity from within a Daytona sandbox
 * Run this to verify if the worker can reach Convex and Anthropic APIs
 */

import { Daytona } from "@daytonaio/sdk";

async function testNetworkConnectivity(sandboxId: string) {
  console.log("=== Daytona Sandbox Network Diagnostics ===\n");

  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY!,
    apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
    target: (process.env.DAYTONA_TARGET || "eu") as "eu" | "us" | "asia",
  });

  try {
    const sandbox = await daytona.get(sandboxId);
    console.log(`✓ Connected to sandbox: ${sandboxId}\n`);

    // Test 1: Basic DNS resolution
    console.log("Test 1: DNS Resolution");
    const dnsTest = await sandbox.process.executeCommand(
      "nslookup google.com"
    );
    console.log(
      dnsTest.exitCode === 0
        ? "✓ DNS resolution works"
        : `✗ DNS resolution failed: ${dnsTest.result}`
    );
    console.log();

    // Test 2: Can reach external HTTPS endpoints
    console.log("Test 2: External HTTPS connectivity");
    const httpsTest = await sandbox.process.executeCommand(
      "curl -I https://www.google.com --max-time 5"
    );
    console.log(
      httpsTest.exitCode === 0
        ? "✓ HTTPS requests work"
        : `✗ HTTPS requests failed: ${httpsTest.result}`
    );
    console.log();

    // Test 3: Can reach Convex
    console.log("Test 3: Convex connectivity");
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      console.log("⚠ CONVEX_URL not set, skipping");
    } else {
      const convexDomain = new URL(convexUrl).hostname;
      const convexTest = await sandbox.process.executeCommand(
        `curl -I ${convexUrl} --max-time 10`
      );
      console.log(
        convexTest.exitCode === 0
          ? `✓ Can reach Convex at ${convexDomain}`
          : `✗ Cannot reach Convex: ${convexTest.result}`
      );
      console.log(`Full response:\n${convexTest.result}\n`);
    }

    // Test 4: Can reach Anthropic API
    console.log("Test 4: Anthropic API connectivity");
    const anthropicTest = await sandbox.process.executeCommand(
      "curl -I https://api.anthropic.com --max-time 10"
    );
    console.log(
      anthropicTest.exitCode === 0
        ? "✓ Can reach Anthropic API"
        : `✗ Cannot reach Anthropic API: ${anthropicTest.result}`
    );
    console.log();

    // Test 5: Check if Node.js can make HTTPS requests
    console.log("Test 5: Node.js HTTPS capability");
    const nodeHttpsTest = await sandbox.process.executeCommand(
      `node -e "const https = require('https'); https.get('https://api.anthropic.com', (res) => { console.log('Status:', res.statusCode); process.exit(0); }).on('error', (e) => { console.error(e.message); process.exit(1); });"`
    );
    console.log(
      nodeHttpsTest.exitCode === 0
        ? `✓ Node.js HTTPS works: ${nodeHttpsTest.result}`
        : `✗ Node.js HTTPS failed: ${nodeHttpsTest.result}`
    );
    console.log();

    // Test 6: Check worker logs if session exists
    console.log("Test 6: Check for existing worker logs");
    const workerSessionCheck = await sandbox.process.executeCommand(
      "ls -la /tmp/sandbox-worker.js 2>&1"
    );
    console.log(workerSessionCheck.result);
    console.log();

    // Test 7: Try to run a minimal worker test
    console.log("Test 7: Test ConvexClient connection");
    const convexClientTest = await sandbox.process.executeCommand(
      `node -e "
const { ConvexClient } = require('convex/browser');
const client = new ConvexClient('${process.env.CONVEX_URL || ""}');
client.setAuth(() => Promise.resolve('test-token'));
console.log('ConvexClient created successfully');
setTimeout(() => {
  console.log('Connection state:', client.connectionState());
  process.exit(0);
}, 3000);
"`
    );
    console.log(
      convexClientTest.exitCode === 0
        ? `✓ ConvexClient test: ${convexClientTest.result}`
        : `✗ ConvexClient test failed: ${convexClientTest.result}`
    );
    console.log();

    console.log("=== Diagnostics Complete ===");
  } catch (error) {
    console.error("Error running diagnostics:", error);
    throw error;
  }
}

const sandboxId = process.argv[2];
if (!sandboxId) {
  console.error("Usage: node test-sandbox-network.ts <sandbox-id>");
  process.exit(1);
}

testNetworkConnectivity(sandboxId).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
