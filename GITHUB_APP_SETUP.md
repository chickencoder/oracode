# GitHub App Setup Guide

This guide explains how to set up a GitHub App for Oracode to enable organization-level repository access.

## Prerequisites

- GitHub account with organization admin access
- Convex deployment set up
- Environment variables access in Convex dashboard

## Step 1: Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App

2. **Basic Information:**
   - **Name**: `Oracode` (or your preferred name)
   - **Homepage URL**: Your app URL (e.g., `https://oracode.dev`)
   - **Description**: Brief description of your app

3. **Callback URL:**
   - **Setup URL**: `https://<your-deployment>.convex.site/github/callback`
   - Example: `https://happy-animal-123.convex.site/github/callback`

4. **Webhook:**
   - **Webhook URL**: `https://<your-deployment>.convex.site/github/webhook`
   - **Webhook Secret**: Generate a random secret (save this for later)
   - Example secret generation: `openssl rand -hex 32`

5. **Permissions:**

   **Repository permissions:**
   - Contents: Read & write
   - Metadata: Read-only
   - Pull requests: Read & write (if needed)

   **Organization permissions:**
   - Members: Read-only

6. **Subscribe to events:**
   - Installation
   - Installation repositories

7. **Where can this GitHub App be installed?**
   - Select "Any account" for public app
   - Or "Only on this account" for private testing

8. Click **Create GitHub App**

## Step 2: Generate Private Key

1. After creating the app, scroll to "Private keys" section
2. Click **Generate a private key**
3. Download the `.pem` file - **save this securely**
4. You'll need to add this to Convex environment variables

## Step 3: Note Your App Details

From the GitHub App settings page, note:

- **App ID** (shown at top of settings page)
- **App Slug** (in the URL: `https://github.com/apps/<app-slug>`)
- **Webhook Secret** (the one you generated)
- **Private Key** (the `.pem` file contents)

## Step 4: Configure Convex Environment Variables

1. Go to your Convex Dashboard → Settings → Environment Variables

2. Add the following variables:

```bash
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_SLUG=<your-app-slug>
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_APP_PRIVATE_KEY=<paste-entire-pem-file-contents>
```

**Important for Private Key:**
- Copy the entire contents of the `.pem` file
- Include the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines
- Paste as-is into Convex (newlines will be preserved)

## Step 5: Configure Vite App Environment Variable

Add to your `.env` or `.env.local`:

```bash
VITE_GITHUB_APP_SLUG=<your-app-slug>
VITE_APP_URL=http://localhost:5173  # or your production URL
```

## Step 6: Deploy Convex

Deploy your Convex functions to activate the HTTP endpoints:

```bash
cd packages/convex
pnpm deploy
```

## Step 7: Test the Installation Flow

1. Start your Vite app: `pnpm dev`
2. Sign in with a new user (or one without an organization)
3. You should be redirected to `/install-github-app`
4. Click "Install GitHub App"
5. You'll be redirected to GitHub to select an organization
6. After installation, you'll be redirected back to your app

## Verification

After setup, verify:

1. **Webhook deliveries**: Check GitHub App settings → Advanced → Recent Deliveries
   - Should see `installation` event with 200 response

2. **Convex database**: Check `githubInstallations` table
   - Should have entry with your installation details

3. **Installation tokens**: Test generating a token:
   ```typescript
   // In your app
   const token = await getInstallationToken({ clerkOrgId: org.id });
   ```

## Troubleshooting

### Webhook returns 401 (Invalid signature)
- Check `GITHUB_WEBHOOK_SECRET` matches what you set in GitHub
- Ensure secret is the same in both places

### Webhook returns 500
- Check Convex logs for errors
- Verify `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are set correctly

### Private key errors
- Ensure newlines are preserved (use `\n` in env vars if needed)
- Check the key includes BEGIN/END markers

### Installation callback fails
- Verify `VITE_GITHUB_APP_SLUG` is set correctly
- Check Convex HTTP action logs

## Security Notes

1. **Never commit** private keys or secrets to version control
2. **Rotate** webhook secrets periodically
3. **Use** separate GitHub Apps for dev/staging/production
4. **Limit** repository access permissions to minimum required
5. **Monitor** webhook deliveries for suspicious activity

## Production Checklist

- [ ] GitHub App created with correct permissions
- [ ] Webhook secret generated and configured
- [ ] Private key downloaded and stored securely
- [ ] All environment variables set in Convex
- [ ] Convex functions deployed
- [ ] Vite app environment variables configured
- [ ] Installation flow tested end-to-end
- [ ] Webhook deliveries verified (200 responses)
- [ ] Database entries confirmed
