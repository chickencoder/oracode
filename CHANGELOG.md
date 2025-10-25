# Changelog

All notable changes to Oracode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open source preparation with AGPLv3 license
- Comprehensive documentation (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- Environment variable examples for all workspaces
- Package metadata for all workspaces

## [0.1.0] - 2025-01-XX

### Added
- Initial release of Oracode
- AI-powered coding assistant with Claude Agent SDK integration
- Branch-based workflow with git integration
- Live preview panel for real-time code changes
- Cloud sandboxes powered by Daytona
- GitHub integration for repository access and PR creation
- Real-time collaboration via Convex backend
- Permission controls for AI file operations
- Encrypted secrets storage (AES-256-GCM)
- Organization and project management
- Clerk authentication with organization support
- Webhook handling for GitHub App events
- Sandbox worker for Claude Agent SDK execution
- Preview service for live app previews

### Frontend (apps/app)
- Next.js 15 with React 19
- Tailwind CSS v4 with custom AI component library
- Convex real-time sync
- Branch creation and management UI
- Chat interface with Claude
- Live preview panel with iframe sandbox
- Permission approval UI
- GitHub connection flow
- Settings pages for organizations and projects

### Backend (packages/convex)
- Convex functions for messages, branches, projects
- GitHub App installation and webhook handling
- Daytona sandbox provisioning
- Encrypted secrets management
- Environment variables per project
- Git status tracking
- Permission request/approval system

### Sandbox Worker (packages/sandbox-worker)
- Standalone Node.js worker
- Claude Agent SDK integration
- Real-time message streaming
- Git status capture
- Session management

### Preview Service (apps/preview)
- Cloudflare Worker for serving live previews
- Authentication token validation
- Proxy to sandbox domains

[Unreleased]: https://github.com/yourusername/oracode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/oracode/releases/tag/v0.1.0
