import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    id: v.string(),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
    ),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  }).index("by_session", ["sessionId"]),
  sessions: defineTable({
    agentSessionId: v.optional(v.string()),
    sandboxId: v.string(),
    createdAt: v.number(),
  }),

  // GitHub App installation tracking
  githubInstallations: defineTable({
    orgId: v.string(), // Link to Clerk organization
    githubOrgId: v.number(), // GitHub organization ID
    githubOrgLogin: v.string(), // GitHub organization login name
    installationId: v.number(), // GitHub App installation ID
    installedBy: v.string(), // User ID who installed the app
    installedAt: v.number(), // Installation timestamp
  })
    .index("by_org", ["orgId"])
    .index("by_installation_id", ["installationId"]),

  // GitHub App installation state tokens (for OAuth-like flow)
  githubAppState: defineTable({
    stateToken: v.string(), // Random state token for flow security
    userId: v.string(), // User initiating the installation
    orgId: v.optional(v.string()), // Org being set up (if already exists)
    createdAt: v.number(), // For cleanup of old/expired states
    expiresAt: v.number(), // State token expiration
  })
    .index("by_state", ["stateToken"])
    .index("by_user", ["userId"]),

  // Projects linked to GitHub repositories
  projects: defineTable({
    orgId: v.string(), // Link to Clerk organization
    githubRepoId: v.number(), // GitHub repository ID
    name: v.string(), // Project name
    description: v.string(), // Project description
    settings: v.object({
      installCommand: v.string(), // Command to install dependencies
      devCommand: v.string(), // Command to run dev server
      port: v.number(), // Port the dev server runs on
    }),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),
});
