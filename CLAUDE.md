# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oracode is a Next.js-based AI coding assistant powered by Claude via the Claude Agent SDK. It uses Convex for real-time backend state management and Daytona for cloud development environments. The architecture consists of a Next.js frontend app, a Convex backend for messages/branches, and sandboxes powered by Daytona with persistent volumes. Each branch maps to a git branch in the repository.

## Monorepo Structure

This is a pnpm + Turborepo monorepo with the following workspaces:

- **apps/app**: Next.js 15 frontend application with React 19
- **packages/convex**: Convex backend functions and schema (shared package)
- **packages/sandbox-worker**: Standalone Node.js worker that connects Convex to Claude Agent SDK

## Common Commands

### Development

```bash
pnpm dev              # Run all workspaces in dev mode (Next.js app + Convex)
```

### Building

```bash
pnpm build            # Build all packages (uses Turborepo)
pnpm type-check       # Type check all packages
```

### Convex-specific

```bash
cd packages/convex
pnpm dev              # Run Convex dev server
pnpm deploy           # Deploy Convex backend
```

### Sandbox Worker

```bash
cd packages/sandbox-worker
pnpm dev              # Build worker with watch mode (tsup)
pnpm dev:worker       # Run worker with tsx watch
pnpm build            # Build worker bundle for deployment
```

The sandbox worker requires environment variables:

- `CONVEX_URL`: Convex deployment URL
- `BRANCH_ID`: Convex branch ID (Id<"branches">)
- `CLERK_TOKEN`: Clerk authentication token
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude Agent SDK

## Architecture

### Branch & Git Integration

Each branch in Oracode corresponds to a git branch in the connected GitHub repository:

- **Branch creation**: Users specify a branch name when creating a new branch (validated against git naming rules)
- **Automatic checkout**: When a sandbox starts, it clones the repo and checks out the specified git branch using `git checkout -B <branchName>`
- **Branch isolation**: Each branch has its own:
  - Message history
  - Claude Agent SDK session
  - Sandbox worker instance
  - Git working directory

This enables parallel development on multiple features/branches simultaneously.

### Frontend (apps/app)

The app uses Next.js 15 with App Router. Key patterns:

- **Server Components**: Pages fetch data server-side and preload Convex queries
- **Client Components**: Interactive UI components use Convex React hooks (`useQuery`, `useMutation`, `usePreloadedQuery`)
- **Styling**: Tailwind CSS v4 with custom AI-focused component library in `components/ai-elements/`
- **Dark Mode**: Uses `next-themes` with class-based dark mode applied to body element

Main routes:

- `/` - Home page (redirects to onboarding or org page)
- `/:orgSlug` - Organization dashboard with projects list
- `/:orgSlug/project/:projectId` - Project branches list
- `/:orgSlug/branches/:branchId` - Branch view with conversation panel and preview panel
- `/:orgSlug/settings` - Organization settings (Claude API key)
- `/:orgSlug/project/:projectId/settings` - Project settings (dev commands, environment variables)

### Backend (packages/convex)

Convex backend uses the new function syntax with validators. Key files:

- **schema.ts**: Defines `messages`, `branches`, `projects`, `secrets`, `organizationSettings`, and `projectEnvironmentVariables` tables
- **messages.ts**: CRUD operations for messages (queries/mutations)
- **branches.ts**: Branch management functions - each branch maps to a git branch
- **projects.ts**: Project management and GitHub repo linking
- **sandboxActions.ts**: Daytona sandbox provisioning, git clone, and branch checkout
- **organizationSettings.ts**: Encrypted Anthropic API key storage per org
- **projectEnvironmentVariables.ts**: Encrypted environment variables per project
- **types.ts**: Shared TypeScript types exported to other packages

The package exports are configured for use by other workspaces:

- `./_generated/api` - Convex API functions
- `./_generated/dataModel` - TypeScript types for tables
- `./types` - Custom shared types

### Sandbox Worker (packages/sandbox-worker)

A standalone Node.js process that bridges Convex and Claude Agent SDK:

1. **Connects to Convex**: Uses `ConvexClient` to subscribe to real-time updates
2. **Watches for user messages**: Subscribes to `api.messages.getLastUserMessage` for the branch
3. **Streams to Claude**: Uses `@anthropic-ai/claude-agent-sdk` with async generator pattern
4. **Updates Convex**: Writes assistant responses back via mutations

The worker uses:

- **Streaming architecture**: Single persistent Claude Agent SDK session with message queue
- **Session resumption**: Can resume previous agent sessions via `agentSessionId` stored on branch
- **Real-time sync**: Uses `client.onUpdate()` for reactive message processing
- **Branch isolation**: Each branch has its own worker instance and message history

Build configuration:

- **tsup**: Bundles to Node.js executable in `dist/`
- Externalizes `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/sdk`
- Includes shebang for direct execution

## Convex Guidelines

This project follows strict Convex conventions (see `.cursor/rules/convex_rules.mdc`):

### Function Syntax

Always use the new function syntax with explicit args and returns validators:

```typescript
export const exampleQuery = query({
  args: { branchId: v.id("branches") },
  returns: v.array(
    v.object({
      /* ... */
    }),
  ),
  handler: async (ctx, args) => {
    // implementation
  },
});
```

### Function Registration

- Use `query`, `mutation`, `action` for public functions
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Always include `returns` validator, use `v.null()` if no return value

### Function References

- Import `api` from `@repo/convex/_generated/api` for public functions
- Import `internal` from `@repo/convex/_generated/api` for internal functions
- Call functions via `ctx.runQuery(api.messages.getLastUserMessage, { branchId })`

### Queries

- Use `.withIndex()` instead of `.filter()` for better performance
- Define indexes in schema with descriptive names: `by_branch`, `by_project`, `by_org_and_branch`, `by_field1_and_field2`
- Use `.unique()` to get single result (throws if multiple)
- Use `.first()` to get single result (returns null if none)

### TypeScript Types

- Import `Id<"tableName">` from `./_generated/dataModel` for document IDs
- Import `Doc<"tableName">` for full document types
- Be strict with ID types (use `Id<"users">` not `string`)
- System fields: `_id: v.id(tableName)`, `_creationTime: v.number()`

## Frontend Patterns

### Convex Integration

Server components preload queries and pass to client components:

```typescript
// Server Component
const preloadedMessages = await preloadQuery(api.branches.getMessagesByBranchId, { branchId });
return <BranchClient preloadedMessages={preloadedMessages} />;

// Client Component
const messages = usePreloadedQuery(preloadedMessages);
```

**IMPORTANT**: Most queries require organization authentication. Always use the "skip" token pattern when data isn't ready:

```typescript
// CORRECT - waits for auth/data before calling query
const branches = useQuery(
  api.branches.getBranchesByProject,
  projectId ? { projectId: projectId as Id<"projects"> } : "skip"
);

// WRONG - will fail with "User must be authenticated with an organization"
const branches = useQuery(api.branches.getBranchesByProject, { projectId });
```

### AI Components

The `components/ai-elements/` directory contains a custom component library for AI interactions:

- `conversation.tsx` - Message list container with scroll handling
- `prompt-input.tsx` - Rich input with attachments, model selector, toolbar
- `message.tsx` - Message bubbles with avatars
- `tool.tsx` - Tool use/result rendering
- `code-block.tsx` - Syntax highlighted code with copy button
- `reasoning.tsx`, `chain-of-thought.tsx` - Thinking indicators
- `artifact.tsx` - Large generated content (code, documents)

### Styling Notes

- Dark mode class is applied to `<body>` element in layout
- Uses `class-variance-authority` for component variants
- Uses `tailwind-merge` for className merging
- Custom animation library: `tw-animate-css`

## Key Dependencies

- **@anthropic-ai/claude-agent-sdk**: Core agent integration
- **@anthropic-ai/sdk**: Anthropic API client
- **convex**: Backend platform (browser client in frontend, Node client in worker)
- **@daytonaio/sdk**: Daytona cloud development environments
- **@ai-sdk/react**: Vercel AI SDK for streaming UI
- **next-safe-action**: Type-safe server actions
- **zod**: Schema validation (v4.x)
- **react-hook-form** + **@hookform/resolvers**: Form handling
- **sonner**: Toast notifications
- **streamdown**: Markdown streaming parser

## Development Notes

- **Turborepo**: Uses task dependencies (`dependsOn: ["^build"]`) to ensure correct build order
- **Package Manager**: pnpm with workspace protocol (`"@repo/convex": "workspace:*"`)
- **TypeScript**: Strict mode enabled across all packages
- **Environment Files**: `.env.local` at both root and app levels
- **Build Outputs**:
  - Next.js: `.next/` directory
  - Convex: Type generation in `_generated/`
  - Sandbox worker: `dist/` for deployment bundle
