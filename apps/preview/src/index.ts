import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";

type Bindings = {
  CONVEX_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Parse hostname to extract branch ID
function parseHostname(hostname: string): {
  branchId: string;
} | null {
  // Expected format: branchId.preview.oracode.dev OR branchId.preview.oracode.local
  const parts = hostname.split(".");

  // Need exactly 4 parts: [branchId, "preview", "oracode", "dev"|"local"]
  if (
    parts.length !== 4 ||
    parts[1] !== "preview" ||
    parts[2] !== "oracode" ||
    (parts[3] !== "dev" && parts[3] !== "local")
  ) {
    return null;
  }

  const branchId = parts[0];

  return { branchId };
}

// Main proxy handler
app.all("*", async (c) => {
  const hostname = new URL(c.req.url).hostname;
  console.log("Proxying request for hostname:", hostname);

  // Parse hostname
  const parsed = parseHostname(hostname);
  if (!parsed) {
    return c.html(
      `<html><body><h1>Invalid URL Format</h1><p>Expected format: branchId.preview.oracode.dev (or .local for local dev)</p></body></html>`,
      400,
    );
  }

  const { branchId } = parsed;
  console.log("Parsed branchId:", branchId);

  // Initialize Convex client
  const convex = new ConvexHttpClient(c.env.CONVEX_URL);

  try {
    // Get branch by ID (using public query)
    const branch = await convex.query("branches:getBranchByIdPublic" as any, {
      branchId: branchId,
    });

    if (!branch) {
      return c.html(
        `<html><body><h1>Branch Not Found</h1><p>No branch found with ID: ${branchId}</p></body></html>`,
        404,
      );
    }

    // Check if preview URL is available
    if (!branch.sandboxDomain || !branch.sandboxPreviewToken) {
      return c.html(
        `<html><body><h1>Preview Not Available</h1><p>This branch doesn't have a preview URL yet.</p></body></html>`,
        503,
      );
    }

    // Proxy the request to the sandbox domain
    const targetUrl = new URL(c.req.url);
    targetUrl.protocol = "https:";
    targetUrl.host = new URL(branch.sandboxDomain).host;

    console.log("Proxying to:", targetUrl.toString());

    // Build headers
    const headers = new Headers(c.req.raw.headers);
    headers.set("Host", targetUrl.host);

    // Rewrite Referer and Origin to match target domain (fixes CORS/403 issues)
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

    // Add Daytona preview authentication headers
    headers.set("x-daytona-preview-token", branch.sandboxPreviewToken);
    headers.set("X-Daytona-Skip-Preview-Warning", "true");
    headers.set("X-Daytona-Disable-CORS", "true");

    // Forward the request (don't follow redirects - we'll handle them)
    const response = await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers,
      body:
        c.req.method !== "GET" && c.req.method !== "HEAD"
          ? c.req.raw.body
          : undefined,
      redirect: "manual",
    });

    // Return the proxied response with CORS headers for iframe embedding
    const responseHeaders = new Headers(response.headers);

    // Rewrite Location header for redirects to keep requests going through proxy
    const location = responseHeaders.get("Location");
    if (location) {
      try {
        const locationUrl = new URL(location, targetUrl.toString());
        // If redirect is to the Daytona domain, rewrite it to our proxy domain
        if (locationUrl.host === targetUrl.host) {
          const proxyUrl = new URL(c.req.url);
          locationUrl.protocol = proxyUrl.protocol;
          locationUrl.host = proxyUrl.host;
          responseHeaders.set("Location", locationUrl.toString());
        }
      } catch (e) {
        // Invalid URL, leave as-is
      }
    }

    // Allow iframe embedding from any origin (needed for preview)
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
      `<html><body><h1>Proxy Error</h1><p>${error instanceof Error ? error.message : "Unknown error"}</p></body></html>`,
      500,
    );
  }
});

export default app;
