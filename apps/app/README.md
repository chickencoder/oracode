# Oracode Frontend Application

The main Next.js frontend application for Oracode, built with React 19 and Vite.

## Overview

This is the primary user interface for Oracode, providing:

- **Chat Interface**: Interact with Claude Code in a conversational UI
- **Branch Management**: Create, view, and manage git branches
- **Live Preview**: See your code changes in real-time
- **Project Settings**: Configure repositories, dev commands, and environment variables
- **GitHub Integration**: Connect repositories and manage installations
- **Organization Management**: Multi-tenant support with Clerk

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Build Tool**: Vite (using Rolldown)
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI + custom AI component library
- **State Management**: Convex real-time queries
- **Authentication**: Clerk (user + organization management)
- **Routing**: React Router v7
- **Form Handling**: React Hook Form + Zod validation
- **Deployment**: Cloudflare Pages

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Convex deployment running
- Environment variables configured (see `.env.example`)

### Running Locally

```bash
# From the root directory
pnpm dev

# Or just this app
cd apps/app
pnpm dev
```

The app will be available at `http://localhost:5173`

### Building

```bash
pnpm build
```

Output goes to `.next/` directory.

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

## Project Structure

```
src/
├── components/
│   ├── ai-elements/      # AI-specific UI components
│   ├── ui/               # Radix UI components
│   └── *.tsx             # Feature components
├── hooks/                # Custom React hooks
├── layouts/              # Layout components
├── lib/                  # Utilities and helpers
├── pages/                # Route pages
├── types/                # TypeScript types
└── main.tsx              # Entry point
```

### Key Directories

- **`components/ai-elements/`**: Custom components for AI interactions (conversation, messages, prompt input, tasks, etc.)
- **`hooks/`**: Convex query hooks, custom utilities
- **`pages/`**: Route components (projects, branches, settings)
- **`layouts/`**: Shared layouts (dashboard, settings)

## Environment Variables

See `.env.example` for required variables:

- `VITE_CONVEX_URL`: Your Convex deployment URL
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk public key
- `VITE_GITHUB_APP_SLUG`: GitHub App slug

## Deployment

### Cloudflare Pages

```bash
pnpm build
wrangler deploy
```

The app uses Cloudflare Pages for hosting with Vite build output.

## Key Features

### Chat Panel
- Real-time message streaming from Claude
- Tool use visualization (Read, Write, Edit, Bash, etc.)
- Permission approval UI
- Optimistic updates

### Preview Panel
- Live iframe preview of running dev server
- Auto-refresh on file changes
- Authentication via preview tokens

### Branch Management
- Create new branches from UI
- Automatic sandbox provisioning
- Git status tracking
- Publish flow (commit, push, create PR)

### Settings
- Organization-level: Claude API key, GitHub connection
- Project-level: Dev commands, environment variables, sandbox config

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) in the root directory.

## License

AGPL-3.0 - See [LICENSE](../../LICENSE) in the root directory.
