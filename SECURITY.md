# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Oracode seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Open a Public Issue

Please do not report security vulnerabilities through public GitHub issues, as this could put users at risk.

### 2. Report Privately

**Email**: security@oracode.dev (or create a GitHub Security Advisory)

**GitHub Security Advisory**: You can also use GitHub's private vulnerability reporting:
1. Go to the [Security tab](https://github.com/yourusername/oracode/security)
2. Click "Report a vulnerability"
3. Fill out the form with details

### 3. What to Include

Please provide as much information as possible:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Location** (file path, function name, line number)
- **Steps to reproduce** the vulnerability
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Proof of concept** or exploit code (if applicable)
- **Your contact information** for follow-up

### 4. Response Timeline

- **Initial Response**: We'll acknowledge your report within **48 hours**
- **Status Update**: We'll provide a detailed response within **7 days**, including:
  - Confirmation of the issue
  - Our remediation timeline
  - Any questions we have
- **Resolution**: We aim to release a fix within **30 days** for high-severity issues

### 5. Coordinated Disclosure

We follow responsible disclosure practices:

- We'll work with you to understand and resolve the issue
- We'll keep you informed of our progress
- We'll credit you in the fix announcement (unless you prefer to remain anonymous)
- We ask that you wait for our fix to be released before public disclosure

## Security Best Practices

### For Self-Hosters

If you're running Oracode on your own infrastructure:

1. **Keep dependencies updated**: Run `pnpm audit` regularly
2. **Use strong encryption keys**: Generate a secure `ENCRYPTION_KEY` (32 bytes, hex-encoded)
   ```bash
   openssl rand -hex 32
   ```
3. **Secure your environment variables**: Never commit `.env` files to git
4. **Use HTTPS**: Always run Oracode behind HTTPS in production
5. **Restrict webhook access**: Verify GitHub webhook signatures
6. **Monitor logs**: Watch for suspicious activity in Convex and Daytona logs
7. **Sandbox isolation**: Ensure Daytona sandboxes are properly isolated

### Built-in Security Features

Oracode includes several security measures:

- **Encrypted secrets**: All API keys stored using AES-256-GCM encryption
- **Webhook verification**: GitHub webhooks use HMAC-SHA256 signature verification
- **Sandbox isolation**: Each branch runs in an isolated Daytona environment
- **Permission controls**: Granular control over Claude's file access
- **Authentication**: Clerk-based auth with JWT validation
- **CORS**: Restricted cross-origin access

### Known Limitations

- **Sandbox security**: Sandboxes run user code—ensure you trust your team members
- **AI-generated code**: Claude's code should be reviewed before merging
- **Third-party dependencies**: Relies on Clerk, Convex, Daytona, and Anthropic security

## Security Updates

We'll announce security updates through:

- GitHub Security Advisories
- Release notes in [CHANGELOG.md](CHANGELOG.md)
- GitHub Discussions (for major vulnerabilities)

## Bug Bounty Program

We do not currently have a bug bounty program, but we deeply appreciate security researchers' efforts. We'll publicly credit researchers who responsibly disclose vulnerabilities (with their permission).

## Questions?

If you have questions about Oracode's security that aren't vulnerability reports, feel free to:

- Open a [GitHub Discussion](https://github.com/yourusername/oracode/discussions)
- Email: security@oracode.dev

## Hall of Fame

We'll recognize security researchers who have helped improve Oracode's security:

- *Your name here!*

---

Thank you for helping keep Oracode and our users safe!
