# Daytona Webhook Setup Guide

This guide explains how to configure Daytona webhooks to enable automatic sandbox lifecycle management.

## Overview

Daytona webhooks notify our backend when sandbox state changes (stopped, started, archived). The webhook updates the sandbox state in our database, and when a user navigates to that branch, the frontend automatically resumes the sandbox.

## Step 1: Set Up Webhook Secret (Optional but Recommended)

When Daytona provides webhook signing support, you should configure a secret for signature verification:

### In Daytona Dashboard

1. Go to your Daytona organization settings
2. Navigate to Webhooks section
3. Generate or copy your webhook signing secret

### In Your Convex Deployment

Add the secret as an environment variable:

```bash
# In your Convex dashboard (Settings > Environment Variables)
DAYTONA_WEBHOOK_SECRET=your_webhook_secret_here
```

**Note**: The webhook endpoint will work without this secret, but won't verify signatures. Once Daytona adds signing support, you should add this for security.

## Step 2: Get Your Webhook URL

Your Convex webhook endpoint is:

```
https://[your-convex-deployment].convex.cloud/daytona/webhook
```

To find your exact URL:

1. Go to your Convex dashboard
2. Copy your deployment URL (e.g., `https://happy-animal-123.convex.cloud`)
3. Append `/daytona/webhook`

Example: `https://happy-animal-123.convex.cloud/daytona/webhook`

## Step 3: Register Webhook with Daytona

Once Daytona adds webhook registration to their SDK/API, register your webhook URL:

### Via Daytona Dashboard (Future)

1. Go to Webhooks settings in Daytona
2. Click "Add Webhook"
3. Enter your webhook URL
4. Select events to subscribe to:
   - `sandbox.stopped`
   - `sandbox.started`
   - `sandbox.archived`
5. Save

### Via API (Future)

```bash
curl -X POST https://app.daytona.io/api/webhooks \
  -H "Authorization: Bearer YOUR_DAYTONA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-convex-deployment.convex.cloud/daytona/webhook",
    "events": ["sandbox.stopped", "sandbox.started", "sandbox.archived"],
    "active": true
  }'
```

## Step 4: Test the Webhook

### Manual Test

Send a test webhook payload to your endpoint using the actual Daytona format:

```bash
curl -X POST https://your-convex-deployment.convex.cloud/daytona/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-sandbox-id",
    "newState": "stopped",
    "oldState": "started",
    "organizationId": "your-org-id",
    "updatedAt": "2025-01-15T10:30:00Z"
  }'
```

**Daytona Webhook Payload Format:**
```json
{
  "id": "sandbox-id",
  "newState": "started" | "stopped" | "destroying" | "destroyed",
  "oldState": "previous-state",
  "organizationId": "daytona-org-id",
  "updatedAt": "ISO-8601-timestamp"
}
```

### With Signature (Once Daytona Provides Signing)

```bash
# Generate HMAC-SHA256 signature
SECRET="your_webhook_secret"
PAYLOAD='{"id":"test-sandbox-id","newState":"stopped","oldState":"started","organizationId":"your-org-id","updatedAt":"2025-01-15T10:30:00Z"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST https://your-convex-deployment.convex.cloud/daytona/webhook \
  -H "Content-Type: application/json" \
  -H "X-Daytona-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

## Step 5: Monitor Webhook Delivery

Check your Convex logs to see webhook activity:

1. Go to Convex Dashboard > Logs
2. Filter by function: `http.ts`
3. Look for log messages:
   - `"Received Daytona webhook"`
   - `"Found branch: <branch-id>"`
   - `"Updated branch sandbox state to: stopped"`

When a user navigates to the stopped branch, you'll see in the browser console:
   - `"Sandbox is stopped, resuming..."`

## Signature Verification Details

Our webhook handler supports multiple signature header formats:

- `X-Daytona-Signature` (expected format)
- `X-Webhook-Signature` (fallback)
- `X-Signature` (fallback)

Signature formats supported:
- `sha256=<hex>` (GitHub style)
- `<hex>` (plain hex)

The verification uses HMAC-SHA256 with constant-time comparison to prevent timing attacks.

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL**: Verify the URL in Daytona settings
2. **Check Daytona logs**: Look for webhook delivery errors
3. **Check Convex logs**: Verify webhook is reaching your endpoint
4. **Firewall**: Ensure Daytona IP ranges can reach your Convex deployment

### Signature Verification Failing

1. **Check secret**: Verify `DAYTONA_WEBHOOK_SECRET` is set correctly in Convex
2. **Check header format**: Log the signature header to see what Daytona sends
3. **Check payload**: Ensure the payload matches what was signed (no modifications)

### Auto-Resume Not Working

1. **Check sandbox ID**: Verify the `sandboxId` in webhook matches your branch's `sandboxId`
2. **Check branch lookup**: Verify the `by_sandbox_id` index exists in schema
3. **Check state update**: Look for `"Updated branch sandbox state"` log in Convex
4. **Check client detection**: Open browser console, navigate to branch, verify `"Sandbox is stopped"` log appears
5. **Check resume action**: Verify `resumeSandbox` action is called in Convex logs

## Current Status

**As of January 2025**, Daytona's webhook feature is newly released and the SDK doesn't yet support programmatic webhook registration.

**What works now:**
- ✅ Webhook endpoint is ready at `/daytona/webhook`
- ✅ Signature verification is implemented (when secret is provided)
- ✅ Auto-resume logic is implemented
- ✅ Frontend fallback exists (client-side resume)

**Coming soon:**
- ⏳ Daytona SDK webhook registration methods
- ⏳ Daytona dashboard webhook management UI
- ⏳ Official webhook signature specification

## Security Notes

1. **Always use HTTPS**: Never send webhooks over plain HTTP
2. **Use signature verification**: Configure `DAYTONA_WEBHOOK_SECRET` when available
3. **Rotate secrets regularly**: Update webhook secrets periodically
4. **Monitor for anomalies**: Watch for suspicious webhook activity
5. **Rate limiting**: Convex has built-in rate limiting, but monitor for abuse

## Support

If you encounter issues:

1. Check Convex logs: Convex Dashboard > Logs
2. Check Daytona status: https://status.daytona.io
3. Contact Daytona support: support@daytona.io
4. Review code: `packages/convex/http.ts`, `packages/convex/sandboxes.ts`
