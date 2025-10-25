# Contributing to Oracode

Thank you for your interest in contributing to Oracode! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots or error messages (if applicable)
- Your environment (OS, Node.js version, browser, etc.)

### Suggesting Features

Feature suggestions are welcome! Please create an issue with:

- A clear description of the feature
- Why it would be useful
- Any implementation ideas you have

### Submitting Pull Requests

1. **Fork the repository** and create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code style guidelines

3. **Test your changes** thoroughly
   ```bash
   pnpm type-check
   pnpm build
   ```

4. **Commit your changes** with clear, descriptive commit messages
   ```bash
   git commit -m "Add feature: description of feature"
   ```

5. **Push to your fork** and create a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Fill out the PR template** with all requested information

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- Accounts for: Clerk, Convex, Anthropic, Daytona
- GitHub App configured (see [GITHUB_APP_SETUP.md](GITHUB_APP_SETUP.md))

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/oracode.git
   cd oracode
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables** (see README.md for details)
   - `apps/app/.env`
   - `packages/convex/.env.local`
   - `packages/sandbox-worker/.env`

4. **Start Convex dev server**
   ```bash
   cd packages/convex
   pnpm convex dev
   ```

5. **Run the development server**
   ```bash
   # From root directory
   pnpm dev
   ```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** - Fix all type errors before submitting
- **Use explicit types** - Avoid `any` unless absolutely necessary
- **Prefer interfaces** over type aliases for object shapes
- **Use const assertions** where appropriate

### Convex Functions

- **Always use the new function syntax** with `args` and `returns` validators
- **Use `internalQuery/Mutation/Action`** for private functions
- **Prefer `.withIndex()`** over `.filter()` for performance
- **Add JSDoc comments** for all public functions

Example:
```typescript
/**
 * Get all branches for a project
 */
export const getBranchesByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    _id: v.id("branches"),
    branchName: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
```

### React Components

- **Use functional components** with hooks
- **Prefer composition** over inheritance
- **Keep components focused** - one responsibility per component
- **Use TypeScript** for all props interfaces
- **Avoid `console.log`** - use proper error handling

### File Organization

- **Colocate related files** - keep components, hooks, and utilities together
- **Use index files** sparingly - explicit imports are better
- **Follow existing patterns** in the codebase

## Testing

Currently, Oracode does not have comprehensive tests. **We welcome contributions to improve test coverage!**

When adding tests:
- Use a testing framework (we're open to suggestions - Vitest, Jest, etc.)
- Test critical paths first (auth, Convex mutations, sandbox provisioning)
- Include E2E tests for key user flows

## Commit Message Guidelines

We don't enforce a strict format, but good commit messages help:

- **Use present tense** - "Add feature" not "Added feature"
- **Be descriptive** - "Fix bug in branch creation" not "Fix bug"
- **Reference issues** - "Closes #123" or "Fixes #456"

Examples:
```
Add GitHub webhook signature verification
Fix race condition in sandbox worker startup
Update README with deployment instructions
```

## Pull Request Process

1. **Update documentation** if you've changed APIs or added features
2. **Add tests** for new functionality (when test framework is in place)
3. **Ensure all checks pass** (type-check, build)
4. **Request review** from maintainers
5. **Address feedback** promptly and professionally

### PR Review Criteria

- Code quality and style consistency
- TypeScript type safety
- Performance considerations
- Security implications
- Documentation completeness

## Project Structure

```
oracode/
├── apps/
│   ├── app/              # Main Next.js frontend
│   ├── www/              # Marketing site
│   └── preview/          # Cloudflare Worker for previews
├── packages/
│   ├── convex/           # Convex backend (shared)
│   └── sandbox-worker/   # Claude Agent SDK worker
└── scripts/              # Utility scripts
```

### Key Areas

- **Frontend (`apps/app/src`)**: React components, hooks, pages
- **Backend (`packages/convex`)**: Convex functions, schema, actions
- **Sandbox Worker (`packages/sandbox-worker`)**: Claude Agent SDK integration
- **Preview Service (`apps/preview`)**: Cloudflare Worker for live previews

## License

By contributing to Oracode, you agree that your contributions will be licensed under the **AGPL-3.0 license**.

This means:
- Your code will be open source
- Derivatives must also be AGPL-3.0
- If used as a SaaS, source must be made available

See [LICENSE](LICENSE) for full details.

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community discussion
- **CLAUDE.md**: For AI assistant development guidelines

Thank you for contributing to Oracode!
