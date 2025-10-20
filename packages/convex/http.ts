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

// Helper function to verify webhook signature using HMAC-SHA256
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  // Try different signature formats that webhooks commonly use
  const hexSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format 1: "sha256=<hex>" (GitHub style)
  const expectedSignature1 = "sha256=" + hexSignature;
  // Format 2: Just hex
  const expectedSignature2 = hexSignature;

  // Constant-time comparison for both formats
  const checkSignature = (expected: string) => {
    if (signature.length !== expected.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return result === 0;
  };

  return (
    checkSignature(expectedSignature1) || checkSignature(expectedSignature2)
  );
}

// Helper function to verify GitHub webhook signature (uses same logic)
async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return verifyWebhookSignature(payload, signature, secret);
}

// Helper function to handle Daytona webhook payload
async function handleDaytonaWebhook(ctx: any, body: any): Promise<Response> {
  // Actual webhook payload format from Daytona:
  // {
  //   "id": "sandbox-id",
  //   "newState": "starting" | "started" | "stopped" | "unknown" | "destroying" | "destroyed",
  //   "oldState": "...",
  //   "organizationId": "...",
  //   "updatedAt": "2025-10-16T14:44:21.982Z"
  // }

  const sandboxId = body.id;
  const newState = body.newState;
  const oldState = body.oldState;

  if (!sandboxId) {
    console.error("Invalid webhook payload - missing id:", body);
    return new Response("Invalid payload", { status: 400 });
  }

  console.log("Received Daytona webhook:", { sandboxId, newState, oldState });

  // Map Daytona states to our states
  // Daytona states: starting, started, stopped, unknown, destroying, destroyed
  // Our states: running, stopped, archived
  let mappedState: "running" | "stopped" | "archived" | null = null;

  if (newState === "started") {
    mappedState = "running";
  } else if (newState === "stopped") {
    mappedState = "stopped";
  } else if (newState === "destroying" || newState === "destroyed") {
    // Sandbox is being deleted
    mappedState = "archived";
  } else if (newState === "starting" || newState === "unknown") {
    // Transitional states - log but don't update
    console.log(
      `Sandbox ${sandboxId} transitioning: ${oldState} -> ${newState}`,
    );
    return new Response(null, { status: 200 });
  }

  if (mappedState) {
    await ctx.runMutation(internal.sandboxes.handleSandboxStateChange, {
      sandboxId,
      event: `sandbox.${newState}`,
      state: mappedState,
    });
  }

  return new Response(null, { status: 200 });
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
      },
    );

    const installationJson = await installationData.json();

    // Validate GitHub API response with Zod
    const installation = githubInstallationSchema.parse(installationJson);

    // Store installation in Convex (also validates and deletes state token)
    const { installedBy, existingOrgId } = await ctx.runMutation(
      internal.github.storeInstallation,
      {
        stateToken: state,
        installationId: parseInt(installationId),
        githubOrgId: installation.account.id,
        githubOrgLogin: installation.account.login,
      },
    );

    let clerkOrgId: string;
    let slug: string;

    if (existingOrgId) {
      // Reconnecting from settings - org already exists
      clerkOrgId = existingOrgId;

      // Get org slug from Clerk
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        throw new Error("CLERK_SECRET_KEY environment variable is required");
      }
      const { createClerkClient } = await import("@clerk/backend");
      const clerk = createClerkClient({ secretKey: clerkSecretKey });
      const org = await clerk.organizations.getOrganization({
        organizationId: clerkOrgId,
      });
      slug = org.slug || org.id;

      // Link the installation to the existing org
      await ctx.runMutation(
        internal.github.linkOrganizationToInstallationInternal,
        {
          githubOrgLogin: installation.account.login,
          clerkOrgId: clerkOrgId,
        },
      );

      // Redirect back to settings page
      const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";
      return Response.redirect(
        `${appUrl}/${slug}/settings/github?reconnect=success`,
        302,
      );
    } else {
      // New user - create Clerk organization via Backend API
      const orgData = await ctx.runAction(
        internal.github.createClerkOrganization,
        {
          userId: installedBy,
          githubOrgLogin: installation.account.login,
        },
      );
      clerkOrgId = orgData.clerkOrgId;
      slug = orgData.slug;

      // Link the installation to the newly created org
      await ctx.runMutation(
        internal.github.linkOrganizationToInstallationInternal,
        {
          githubOrgLogin: installation.account.login,
          clerkOrgId: clerkOrgId,
        },
      );

      // Redirect directly to org dashboard
      // Clerk will automatically set this as the active org when user visits the page
      const appUrl = process.env.SITE_URL || "http://app.oracode.dev";
      return Response.redirect(`${appUrl}/${slug}?github=connected`, 302);
    }
  } catch (error) {
    console.error("GitHub installation callback error:", error);
    const appUrl = process.env.SITE_URL || "http://app.oracode.dev";
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

    // Handle events
    const eventType = payload.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } =
        payload.data;

      const primaryEmail = email_addresses?.find(
        (e: any) => e.id === payload.data.primary_email_address_id,
      );

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
    } else if (
      eventType === "organization.created" ||
      eventType === "organization.updated"
    ) {
      const { id, slug, name } = payload.data;

      if (!id || !slug || !name) {
        console.error("Missing required org fields:", { id, slug, name });
        return new Response("Missing org fields", { status: 400 });
      }

      await ctx.runMutation(internal.organizations.upsertFromClerk, {
        clerkOrgId: id,
        slug: slug,
        name: name,
      });
    }

    return new Response(null, { status: 200 });
  }),
});

// Daytona webhook handler
http.route({
  path: "/daytona/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Signature verification (if Daytona provides it)
      const webhookSecret = process.env.DAYTONA_WEBHOOK_SECRET;

      if (webhookSecret) {
        // Check for common webhook signature headers
        // (Daytona may use x-daytona-signature, x-webhook-signature, or similar)
        const signature =
          request.headers.get("x-daytona-signature") ||
          request.headers.get("x-webhook-signature") ||
          request.headers.get("x-signature");

        if (signature) {
          // Get raw body for signature verification
          const rawBody = await request.text();

          // Verify signature using HMAC-SHA256 (common webhook signing method)
          const isValid = await verifyWebhookSignature(
            rawBody,
            signature,
            webhookSecret,
          );

          if (!isValid) {
            console.error("Invalid webhook signature");
            return new Response("Invalid signature", { status: 401 });
          }

          // Parse the verified body
          const body = JSON.parse(rawBody);
          return await handleDaytonaWebhook(ctx, body);
        } else {
          console.warn(
            "DAYTONA_WEBHOOK_SECRET configured but no signature header found",
          );
          // Allow through but log warning
        }
      }

      // No secret configured or no signature header - parse body normally
      const body = await request.json();
      return await handleDaytonaWebhook(ctx, body);
    } catch (error) {
      console.error("Daytona webhook error:", error);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

export default http;
