# Oracode Convex Backend

Convex backend functions and schema for Oracode. This package provides the real-time database, functions, and HTTP endpoints that power the Oracode platform.

## Overview

This package contains:

- **Schema**: Database tables for messages, branches, projects, users, organizations, secrets, etc.
- **Queries**: Real-time data fetching functions
- **Mutations**: Data modification functions
- **Actions**: External API integrations (GitHub, Daytona, Anthropic)
- **HTTP Endpoints**: Webhooks and callbacks
- **Internal Functions**: Private helper functions

## Key Features

- **Real-time Sync**: All data updates propagate instantly to connected clients
- **Type-Safe**: Full TypeScript support with generated types
- **Encrypted Secrets**: AES-256-GCM encryption for API keys and environment variables
- **GitHub Integration**: App installation, webhook handling, token generation
- **Sandbox Provisioning**: Daytona sandbox creation and management
- **Permission System**: Granular approval flow for AI tool use

## Development

### Prerequisites

- Convex account ([convex.dev](https://convex.dev))
- Environment variables configured (see `.env.example`)

### Running Locally

```bash
cd packages/convex
pnpm convex dev
```

This starts the Convex dev server and watches for file changes.

### Deploying

```bash
pnpm convex deploy
```

This deploys your functions to production.

### Type Checking

```bash
pnpm type-check
```

## Project Structure

```
packages/convex/
├── _generated/          # Auto-generated Convex types (gitignored)
├── lib/                 # Helper utilities
│   ├── clerkAuth.ts    # Clerk authentication
│   ├── crypto.ts       # Encryption utilities
│   ├── githubAuth.ts   # GitHub token generation
│   ├── sandbox.ts      # Sandbox utilities
│   └── ...
├── schema.ts            # Database schema definition
├── messages.ts          # Message CRUD operations
├── branches.ts          # Branch management
├── projects.ts          # Project management
├── sandboxActions.ts    # Daytona sandbox provisioning
├── githubActions.ts     # GitHub API interactions
├── http.ts              # HTTP endpoints (webhooks, callbacks)
├── secrets.ts           # Encrypted secret storage
├── variables.ts         # Project environment variables
├── settings.ts          # Organization settings
└── types.ts             # Shared TypeScript types
```

## Schema

### Tables

- **`orgs`**: Clerk organizations
- **`users`**: User profiles synced from Clerk
- **`messages`**: Chat messages between users and Claude
- **`branches`**: Git branches with sandbox state
- **`projects`**: GitHub repositories linked to organizations
- **`secrets`**: Encrypted API keys and tokens
- **`settings`**: Organization-level settings (Claude API key)
- **`variables`**: Project environment variables
- **`permissions`**: Tool use approval requests
- **`githubInstallations`**: GitHub App installations
- **`githubAppState`**: OAuth-like flow state tokens
- **`snapshots`**: Git status snapshots per branch

See [schema.ts](./schema.ts) for full definitions.

## Convex Conventions

This project follows strict Convex best practices:

### Function Syntax

Always use the new function syntax with explicit `args` and `returns` validators:

```typescript
export const exampleQuery = query({
  args: { branchId: v.id("branches") },
  returns: v.array(v.object({ /* ... */ })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("branches")
      .withIndex("by_id", (q) => q.eq("_id", args.branchId))
      .collect();
  },
});
```

### Internal Functions

Use `internalQuery`, `internalMutation`, `internalAction` for private functions:

```typescript
export const internalHelper = internalQuery({
  args: { userId: v.string() },
  returns: v.union(v.object({ /* ... */ }), v.null()),
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

### Indexes

Define indexes in `schema.ts` with descriptive names:

```typescript
branches: defineTable({
  projectId: v.id("projects"),
  branchName: v.string(),
  // ...
})
  .index("by_project", ["projectId"])
  .index("by_project_and_branch_name", ["projectId", "branchName"])
```

Use `.withIndex()` for queries:

```typescript
await ctx.db
  .query("branches")
  .withIndex("by_project", (q) => q.eq("projectId", projectId))
  .collect();
```

## Environment Variables

See `.env.example` for required variables:

- `CLERK_ISSUER_URL`: Clerk issuer URL for JWT validation
- `CLERK_JWT_KEY`: Clerk JWT public key
- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_APP_PRIVATE_KEY`: GitHub App private key (PEM format)
- `GITHUB_WEBHOOK_SECRET`: Webhook signature secret
- `DAYTONA_API_KEY`: Daytona API key
- `ENCRYPTION_KEY`: 32-byte hex key for secret encryption

## HTTP Endpoints

### Webhooks

- **`POST /github/webhook`**: GitHub App webhook handler
  - Handles `installation`, `installation_repositories` events
  - Verifies HMAC-SHA256 signature
  - Creates/updates `githubInstallations` records

### Callbacks

- **`GET /github/callback`**: GitHub App installation callback
  - Completes installation flow
  - Validates state token
  - Redirects back to app

## Security

- **Encryption**: All secrets encrypted with AES-256-GCM before storage
- **Authentication**: Clerk JWT validation on all authenticated functions
- **Webhook Verification**: HMAC signature validation for GitHub webhooks
- **Permission System**: User approval required for sensitive AI operations

## Exports

This package exports:

- `_generated/api`: All Convex function references
- `_generated/dataModel`: TypeScript types for tables
- `types.ts`: Custom shared types (e.g., `MessageData`, `UserInfo`)

Usage in other packages:

```typescript
import { api } from "@repo/convex/_generated/api";
import type { Id, Doc } from "@repo/convex/_generated/dataModel";
import type { MessageData } from "@repo/convex/types";
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) in the root directory.

## License

AGPL-3.0 - See [LICENSE](../../LICENSE) in the root directory.
