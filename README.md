# Oracode

**AI-powered coding assistant that creates branches, writes code, and opens pull requests—all from a chat interface.**

Oracode combines Claude AI with cloud development environments to help technical and non-technical users ship code changes quickly. Chat with Claude, see live previews, and publish directly to GitHub.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## Features

- **AI-Powered Development** - Chat with Claude Code to write, edit, and refactor code
- **Live Preview** - See changes instantly in an integrated web preview panel
- **Branch-Based Workflow** - Each conversation maps to a git branch for isolated development
- **Cloud Sandboxes** - Powered by Daytona for consistent, reproducible development environments
- **GitHub Integration** - Connect your repositories and open pull requests directly from the UI
- **Real-time Collaboration** - Built on Convex for instant updates across all connected clients
- **Permission Controls** - Granular control over what AI can modify (default, accept edits, bypass)

## Architecture

Oracode is a monorepo consisting of:

- **`apps/app`** - Next.js 15 frontend with React 19 and Convex real-time sync
- **`packages/convex`** - Convex backend for messages, branches, projects, and settings
- **`packages/sandbox-worker`** - Standalone Node.js worker bridging Convex ↔ Claude Agent SDK
- **`apps/preview`** - Cloudflare Worker for serving live previews from sandboxes
- **`apps/www`** - Marketing website (Next.js)

### How It Works

1. **User creates a branch** → Oracode provisions a Daytona sandbox and clones the GitHub repo
2. **User chats with Claude** → Messages sync via Convex to the sandbox worker
3. **Claude Agent SDK executes** → Reads/writes files, runs commands, streams responses back
4. **Live preview updates** → Dev server runs in sandbox, preview panel shows changes in real-time
5. **Publish to GitHub** → Commit changes, push branch, open pull request—all automated

## Prerequisites

Before running Oracode locally, you'll need accounts and API keys for:

- **Node.js** 20+ and **pnpm** 10+
- **[Clerk](https://clerk.com)** - User authentication and organization management
- **[Convex](https://convex.dev)** - Real-time backend database
- **[Anthropic](https://console.anthropic.com)** - Claude API key (stored encrypted per-org)
- **[Daytona](https://daytona.io)** - Cloud development environment provider
- **GitHub App** - For repository access (see [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md))

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/oracode.git
cd oracode
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create `.env` or `.env.local` files in the following locations:

#### `apps/app/.env`
```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_GITHUB_APP_SLUG=your-github-app-slug
```

#### `packages/convex/.env.local`
```bash
CLERK_ISSUER_URL=https://your-clerk-domain.clerk.accounts.dev
CLERK_JWT_KEY=clerk-jwt-key-from-dashboard
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-github-app-slug
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
DAYTONA_API_URL=https://api.daytona.io
DAYTONA_API_KEY=your-daytona-api-key
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
```

#### `packages/sandbox-worker/.env`
```bash
CONVEX_URL=https://your-deployment.convex.cloud
ANTHROPIC_API_KEY=sk-ant-...
BRANCH_ID=<set-by-sandbox-provisioning>
CLERK_TOKEN=<set-by-sandbox-provisioning>
```

See [`.env.example`](.env.example) files in each workspace for complete configuration.

### 4. Set up Convex

```bash
cd packages/convex
pnpm convex dev
```

This will create your Convex deployment and generate types.

### 5. Set up GitHub App

Follow the detailed guide in [GITHUB_APP_SETUP.md](./GITHUB_APP_SETUP.md) to create and configure your GitHub App.

### 6. Run the development server

```bash
# From the root directory
pnpm dev
```

This starts:
- Next.js app on `http://localhost:5173`
- Convex dev server with live reload

### 7. Deploy Convex functions

```bash
cd packages/convex
pnpm convex deploy
```

## Development

### Project Structure

```
oracode/
├── apps/
│   ├── app/              # Main Next.js application
│   ├── www/              # Marketing website
│   └── preview/          # Cloudflare Worker for previews
├── packages/
│   ├── convex/           # Convex backend (shared package)
│   └── sandbox-worker/   # Claude Agent SDK worker
├── scripts/              # Utility scripts
├── CLAUDE.md             # AI assistant instructions
├── GITHUB_APP_SETUP.md   # GitHub App setup guide
└── README.md             # This file
```

### Common Commands

```bash
# Development
pnpm dev              # Run all workspaces in dev mode
pnpm build            # Build all packages
pnpm type-check       # Type check all packages

# Convex-specific
cd packages/convex
pnpm dev              # Run Convex dev server
pnpm deploy           # Deploy Convex backend

# Sandbox Worker
cd packages/sandbox-worker
pnpm build            # Build worker bundle for deployment
```

### Key Technologies

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4, Radix UI
- **Backend**: Convex (real-time database and functions)
- **AI**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **Auth**: Clerk (user + org management)
- **Sandboxes**: Daytona (cloud dev environments)
- **Package Manager**: pnpm + Turborepo
- **Type Safety**: TypeScript (strict mode)

## Deployment

### Frontend (Cloudflare Pages)

```bash
cd apps/app
pnpm build
wrangler deploy
```

### Preview Service (Cloudflare Workers)

```bash
cd apps/preview
pnpm build
wrangler deploy
```

### Convex Backend

```bash
cd packages/convex
pnpm convex deploy --prod
```

### Sandbox Worker

The sandbox worker is deployed automatically to each Daytona sandbox instance when a branch is created. The worker bundle is generated via `packages/convex/lib/workerBundle.ts` and injected into the sandbox.

## Security

- **Encrypted Secrets**: All API keys and environment variables are encrypted at rest using AES-256-GCM
- **Webhook Verification**: GitHub webhooks use signature verification
- **Sandbox Isolation**: Each branch runs in an isolated Daytona sandbox
- **Permission Controls**: Users can control what file operations Claude can perform

See [SECURITY.md](./SECURITY.md) for reporting security vulnerabilities.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- ✅ You can use, modify, and distribute this software
- ✅ You can run it privately for personal or internal use
- ⚠️ If you run this as a public service (SaaS), you must release your source code under AGPL-3.0
- ⚠️ Any modifications must also be released under AGPL-3.0

For commercial licensing options, please contact us.

See [LICENSE](./LICENSE) for the full license text.

## Support

- **Documentation**: See [CLAUDE.md](./CLAUDE.md) for architecture details
- **Issues**: [GitHub Issues](https://github.com/yourusername/oracode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/oracode/discussions)

## Acknowledgments

Built with:
- [Claude](https://anthropic.com) by Anthropic
- [Convex](https://convex.dev)
- [Daytona](https://daytona.io)
- [Clerk](https://clerk.com)
- [Next.js](https://nextjs.org)

---

Made with ❤️ by the Oracode team
