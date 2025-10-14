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
    branchId: v.id("branches"),
    userId: v.string(),
    orgId: v.string(),
  })
    .index("by_branch", ["branchId"])
    .index("by_org_and_branch", ["orgId", "branchId"]),
  branches: defineTable({
    projectId: v.id("projects"),
    branchName: v.string(),
    agentSessionId: v.optional(v.string()),
    createdAt: v.number(),
    // Permission mode for Claude Agent SDK
    permissionMode: v.optional(
      v.union(
        v.literal("default"), // Ask for permission (default)
        v.literal("acceptEdits"), // Auto-approve file edits
        v.literal("bypassPermissions"), // Bypass all permission checks
      ),
    ),
    // Sandbox fields (1:1 relationship)
    sandboxId: v.optional(v.string()), // Sandbox ID
    sandboxVolumeId: v.optional(v.string()), // Daytona Volume ID for persistent storage
    sandboxStatus: v.optional(
      v.union(
        v.literal("creating"), // Being provisioned
        v.literal("ready"), // Running and available
        v.literal("error"), // Failed to create
      ),
    ),
    sandboxState: v.optional(
      v.union(
        v.literal("started"), // Sandbox is running
        v.literal("stopped"), // Sandbox is stopped (auto-stopped or manually)
        v.literal("archived"), // Sandbox is archived (after 7 days stopped)
      ),
    ),
    sandboxDomain: v.optional(v.string()), // Public domain for web preview
    sandboxPreviewToken: v.optional(v.string()), // Auth token for preview URL (private sandboxes)
    sandboxError: v.optional(v.string()), // Error message if failed
    sandboxLoadingStage: v.optional(
      v.union(
        v.literal("provisioning"), // Creating sandbox
        v.literal("installing"), // Running install command
        v.literal("starting"), // Starting dev server
      ),
    ),
    // Sandbox session tracking for long-running processes
    devSessionId: v.optional(v.string()), // Session for dev server
    devCommandId: v.optional(v.string()), // Command ID for dev server
    workerSessionId: v.optional(v.string()), // Session for worker
    workerCommandId: v.optional(v.string()), // Command ID for worker
  }).index("by_project", ["projectId"]),

  // Permission requests for tool use approval
  pendingPermissions: defineTable({
    id: v.string(), // UUID for tracking
    branchId: v.id("branches"),
    toolName: v.string(),
    toolInput: v.any(), // Tool input parameters
    status: v.union(
      v.literal("pending"), // Awaiting user decision
      v.literal("approved"), // User approved
      v.literal("denied"), // User denied
    ),
    requestedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    denialMessage: v.optional(v.string()),
    orgId: v.string(),
    userId: v.string(),
  })
    .index("by_branch", ["branchId"])
    .index("by_branch_and_status", ["branchId", "status"])
    .index("by_request_id", ["id"]),

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

  // Encrypted secret storage (pure storage, no business logic)
  secrets: defineTable({
    encryptedValue: v.string(), // Encrypted secret data
    encryptionMetadata: v.object({
      iv: v.string(), // Initialization vector (base64)
      algorithm: v.string(), // e.g., "AES-256-GCM"
      version: v.number(), // Encryption scheme version
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(), // User ID who created the secret
  }),

  // Organization-level settings and API keys
  settings: defineTable({
    orgId: v.string(), // Link to Clerk organization
    anthropicApiKey: v.optional(v.id("secrets")), // Reference to encrypted Anthropic API key
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  // Project environment variables (references secrets)
  variables: defineTable({
    projectId: v.id("projects"), // Link to project
    key: v.string(), // Environment variable name (e.g., "DATABASE_URL", "PORT")
    secretId: v.id("secrets"), // Reference to encrypted secret value
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(), // User ID who created the variable
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_key", ["projectId", "key"]), // Ensure unique keys per project
});
