import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import { ErrorTemplate, LoadingTemplate } from "./template";

type Bindings = {
  CONVEX_URL: string;
  PREVIEW_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function parseHostname(
  hostname: string,
): { branchName: string; projectSlug: string; orgSlug: string } | null {
  const parts = hostname.split(".");

  // Check for valid oracode domain: {projectSlug}-git-{branch}.{orgSlug}.oracode.local
  if (
    parts.length === 4 &&
    parts[2] === "oracode" &&
    (parts[3] === "local" || parts[3] === "dev")
  ) {
    const orgSlug = parts[1];
    const firstPart = parts[0];

    // Must have format: {projectSlug}-git-{branch}
    const gitIndex = firstPart.indexOf("-git-");
    if (gitIndex !== -1) {
      const projectSlug = firstPart.substring(0, gitIndex);
      const branchName = firstPart.substring(gitIndex + 5); // +5 for "-git-"

      if (projectSlug && branchName) {
        return { branchName, projectSlug, orgSlug };
      }
    }
  }

  return null;
}

app.options("*", async (c) => {
  return c.body(null, 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  });
});

app.all("*", async (c) => {
  const reqUrl = new URL(c.req.url);
  const parsed = parseHostname(reqUrl.hostname);

  if (!parsed) {
    return c.html(
      ErrorTemplate({
        title: "Invalid URL Format",
        message:
          "Expected format: {projectSlug}-git-{branch}.{orgSlug}.oracode.local",
        statusCode: 400,
        details: `Received: ${reqUrl.hostname}`,
      }),
      400,
    );
  }

  // Create Convex client with pre-shared secret for authentication
  const convex = new ConvexHttpClient(c.env.CONVEX_URL);

  // Check if PREVIEW_SECRET is configured
  if (!c.env.PREVIEW_SECRET) {
    return c.html(
      ErrorTemplate({
        title: "Configuration Error",
        message:
          "PREVIEW_SECRET is not configured. Please set it in wrangler environment.",
        statusCode: 500,
      }),
      500,
    );
  }

  try {
    // Call public query with pre-shared secret for authentication
    const branch = await convex.query(api.branches.getPreviewBranchByNames, {
      orgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      branchName: parsed.branchName,
      previewSecret: c.env.PREVIEW_SECRET,
    });

    if (!branch) {
      return c.html(
        ErrorTemplate({
          title: "Branch Not Found",
          message: "The requested branch does not exist or is not accessible.",
          statusCode: 404,
          details: `${parsed.orgSlug}/${parsed.projectSlug}/${parsed.branchName}`,
        }),
        404,
      );
    }

    if (!branch.sandboxDomain || !branch.sandboxPreviewToken) {
      // Check if sandbox is being provisioned
      const isProvisioning =
        branch.sandboxStatus === "provisioning" ||
        branch.sandboxStatus === "starting" ||
        branch.sandboxLoadingStage === "installing";

      if (isProvisioning) {
        // Return a loading page that will auto-retry
        return c.html(
          LoadingTemplate({
            title: "Preparing Preview",
            message: "Your development environment is starting up...",
            status: branch.sandboxStatus,
          }),
          503,
        );
      }

      // Not provisioning - actually unavailable
      return c.html(
        ErrorTemplate({
          title: "Preview Not Available",
          message: "This branch doesn't have a preview URL yet.",
          statusCode: 503,
          details:
            "The development environment needs to be started. Please check your project settings.",
        }),
        503,
      );
    }

    const targetUrl = new URL(reqUrl);
    targetUrl.protocol = "https:";
    targetUrl.host = new URL(branch.sandboxDomain).host;

    const headers = new Headers(c.req.raw.headers);
    headers.set("Host", targetUrl.host);

    const upgradeHeader = c.req.header("upgrade");
    const isWebSocket = upgradeHeader?.toLowerCase() === "websocket";

    if (!isWebSocket) {
      const referer = c.req.header("referer");
      if (referer) {
        const refererUrl = new URL(referer);
        refererUrl.protocol = "https:";
        refererUrl.host = targetUrl.host;
        headers.set("Referer", refererUrl.toString());
      }

      const origin = c.req.header("origin");
      if (origin) {
        headers.set("Origin", `https://${targetUrl.host}`);
      }
    }

    headers.set("x-daytona-preview-token", branch.sandboxPreviewToken);
    headers.set("X-Daytona-Skip-Preview-Warning", "true");
    headers.set("X-Daytona-Disable-CORS", "true");

    if (isWebSocket) {
      const response = await fetch(targetUrl.toString(), {
        method: c.req.method,
        headers,
        redirect: "manual",
      });
      return response;
    }

    const response = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers,
      body:
        c.req.method !== "GET" && c.req.method !== "HEAD"
          ? c.req.raw.body
          : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers(response.headers);

    const location = responseHeaders.get("Location");
    if (location && location.startsWith("http")) {
      const locationUrl = new URL(location);
      if (locationUrl.host === targetUrl.host) {
        locationUrl.protocol = reqUrl.protocol;
        locationUrl.host = reqUrl.host;
        responseHeaders.set("Location", locationUrl.toString());
      }
    }

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.delete("X-Frame-Options");
    responseHeaders.delete("Content-Security-Policy");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return c.html(
      ErrorTemplate({
        title: "Proxy Error",
        message:
          "An error occurred while connecting to your development environment.",
        statusCode: 500,
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      500,
    );
  }
});

export default app;
