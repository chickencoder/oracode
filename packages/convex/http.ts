import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { z } from "zod";
import { Webhook } from "svix";

// Zod schema for GitHub installation response
const githubInstallationSchema = z.object({
  id: z.number(),
  account: z.object({
    id: z.number(),
    login: z.string(),
    avatar_url: z.string(),
  }),
});

const http = httpRouter();

// Helper function to verify GitHub webhook signature using Web Crypto API
async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  const expectedSignature = "sha256=" + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}

// GitHub App installation callback (handles both GET and POST)
const handleGitHubCallback = httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const installationId = url.searchParams.get("installation_id");
    const setupAction = url.searchParams.get("setup_action");
    const state = url.searchParams.get("state");

    // Validate parameters
    if (!installationId || !state || setupAction !== "install") {
      return new Response("Invalid callback parameters", { status: 400 });
    }

    try {
      // Fetch installation details from GitHub using JWT
      const jwt = await ctx.runAction(internal.github.generateAppToken, {});

      const installationData = await fetch(
        `https://api.github.com/app/installations/${installationId}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      const installationJson = await installationData.json();

      // Validate GitHub API response with Zod
      const installation = githubInstallationSchema.parse(installationJson);

      // Store installation in Convex (will create Clerk org)
      await ctx.runMutation(internal.github.storeInstallation, {
        stateToken: state,
        installationId: parseInt(installationId),
        githubOrgId: installation.account.id,
        githubOrgLogin: installation.account.login,
      });

      // Redirect back to app with success and GitHub org name
      const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";
      return Response.redirect(
        `${appUrl}/new-account?installation=success&githubOrg=${encodeURIComponent(installation.account.login)}`,
        302
      );
    } catch (error) {
      console.error("GitHub installation callback error:", error);
      const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";
      return Response.redirect(`${appUrl}/?installation=error`, 302);
    }
});

http.route({
  path: "/github/callback",
  method: "GET",
  handler: handleGitHubCallback,
});

// GitHub webhook handler
http.route({
  path: "/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    if (!signature || !event) {
      return new Response("Missing headers", { status: 400 });
    }

    // Get raw body for signature verification
    const body = await request.text();

    // Verify webhook signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    const isValid = await verifyGitHubSignature(body, signature, webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Handle different event types
    if (event === "installation") {
      await ctx.runMutation(internal.github.handleInstallationEvent, {
        action: payload.action,
        installation: payload.installation,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

// Clerk webhook handler
http.route({
  path: "/clerk/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured");
      return new Response("Server configuration error", { status: 500 });
    }

    // Get webhook headers
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    // Get raw body
    const body = await request.text();

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let payload: any;

    try {
      payload = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 401 });
    }

    // Handle user events
    const eventType = payload.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } = payload.data;

      const primaryEmail = email_addresses?.find((e: any) => e.id === payload.data.primary_email_address_id);

      if (!primaryEmail?.email_address) {
        console.error("No primary email found for user:", id);
        return new Response("No primary email", { status: 400 });
      }

      await ctx.runMutation(internal.users.upsertFromClerk, {
        clerkId: id,
        email: primaryEmail.email_address,
        firstName: first_name || undefined,
        lastName: last_name || undefined,
        imageUrl: image_url || undefined,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
