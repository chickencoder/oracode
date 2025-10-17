# Oracode Preview Service

Cloudflare Workers proxy service for Daytona sandboxes with Clerk authentication.

## URL Pattern

```
http://branchId.preview.oracode.local:8787
```

- `branchId`: Convex branch ID (e.g., `jd7abc123def456`)
- `preview`: Static subdomain identifier
- Port `8787` for local development

## Local Development

### 1. Set up local DNS

**On macOS:**

Since `/etc/hosts` doesn't support wildcards, you have two options:

#### Option A: Manual entries (Simple)
Add specific subdomains to `/etc/hosts`:

```bash
sudo nano /etc/hosts
```

Add these lines (replace with your actual branch IDs):
```
127.0.0.1 jd7abc123.preview.oracode.local
127.0.0.1 jd7xyz789.preview.oracode.local
# Add more as needed
```

#### Option B: dnsmasq (Recommended for wildcard support)

Install and configure dnsmasq for true wildcard DNS:

```bash
# Install dnsmasq
brew install dnsmasq

# Configure dnsmasq to resolve *.oracode.local to 127.0.0.1
echo 'address=/.oracode.local/127.0.0.1' | sudo tee -a $(brew --prefix)/etc/dnsmasq.conf

# Start dnsmasq
sudo brew services start dnsmasq

# Configure macOS to use dnsmasq for .local domains
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/local

# Test the configuration
ping test.oracode.local  # Should resolve to 127.0.0.1
```

**On Linux:**

Use dnsmasq (usually pre-installed):

```bash
# Add wildcard rule
echo 'address=/.oracode.local/127.0.0.1' | sudo tee -a /etc/dnsmasq.conf

# Restart dnsmasq
sudo systemctl restart dnsmasq

# Configure NetworkManager to use dnsmasq
echo '[main]
dns=dnsmasq' | sudo tee /etc/NetworkManager/conf.d/dns.conf

sudo systemctl restart NetworkManager
```

**On Windows:**

Windows doesn't support wildcards in hosts file. Use **Acrylic DNS Proxy**:

1. Download from https://mayakron.altervista.org/support/acrylic/Home.htm
2. Install and edit `AcrylicHosts.txt`:
   ```
   127.0.0.1 *.oracode.local
   ```
3. Restart Acrylic DNS service

### 2. Configure environment variables

Copy `.dev.vars.example` to `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your Convex deployment URL.

### 3. Start the development server

```bash
pnpm dev
```

The proxy will run on `http://localhost:8787`.

### 4. Test the proxy

Visit: `http://jd7abc123.preview.oracode.local:8787`

Replace `jd7abc123` with your actual Convex branch ID.

## How It Works

1. **Parse URL**: Extracts `branchId` from hostname (e.g., `jd7abc123.preview.oracode.local`)
2. **Query Convex**: Looks up branch by ID using public query
3. **Check Sandbox State**:
   - If `Date.now() > sandboxAliveUntil` → Sandbox is asleep, wake it up
   - If `sandboxStatus === "creating"` → Show loading page
   - If `sandboxStatus === "error"` → Show error page
4. **Proxy Request**: Forward to Daytona sandbox domain with auth headers

## Configuration

This project uses `wrangler.json` (the modern format for Wrangler configuration). Environment variables for local development are stored in `.dev.vars` (gitignored).

### Required Environment Variables

1. **`CONVEX_URL`**: Your Convex deployment URL (e.g., `https://usable-marlin-709.convex.cloud`)
2. **`PROXY_SECRET_KEY`**: Shared secret for authenticating with Convex HTTP actions

### Setting Up the Shared Secret

The proxy authenticates with Convex using a shared secret. You need to set the same secret in both places:

**Generate a secret:**
```bash
openssl rand -hex 32
```

**Set in proxy (`.dev.vars`):**
```
CONVEX_URL=https://your-deployment.convex.cloud
PROXY_SECRET_KEY=<your-generated-secret>
```

**Set in Convex:**
```bash
cd packages/convex
npx convex env set PROXY_SECRET_KEY <your-generated-secret>
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

Set environment variables using wrangler secrets:

```bash
npx wrangler secret put CONVEX_URL
npx wrangler secret put DAYTONA_API_KEY
```

## Authentication

The preview service uses a pre-shared secret for authentication with Convex:

1. User accesses preview URL (e.g., `branch-name-project-slug-org-slug.preview.oracode.dev`)
2. Worker parses org/project/branch from URL
3. Worker calls Convex public query with pre-shared secret
4. Convex verifies secret and returns branch data
5. Worker proxies request to Daytona sandbox with preview token

### Setting Secrets for Production

```bash
# Set preview secret (required - must match Convex PREVIEW_SECRET)
wrangler secret put PREVIEW_SECRET --env production

# Set Convex URL (required)
wrangler secret put CONVEX_URL --env production
```

### Setting Secret in Convex

The same secret must be configured in Convex:

```bash
cd packages/convex
npx convex env set PREVIEW_SECRET <your-secret-here>
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

## Features

- ✅ Pre-shared secret authentication with Convex
- ✅ Automatic sandbox wake on first request
- ✅ Handles Daytona authentication headers
- ✅ Loading states for sandbox creation/wake
- ✅ Error handling and user-friendly messages
- ✅ Secure authentication between services
