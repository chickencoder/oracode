import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";

type Bindings = {
  CONVEX_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function parseHostname(
  hostname: string
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
      `<html><body><h1>Invalid URL Format</h1><p>Expected format: {projectSlug}-git-{branch}.{orgSlug}.oracode.local</p></body></html>`,
      400,
    );
  }

  const convex = new ConvexHttpClient(c.env.CONVEX_URL);

  try {
    const branch = await convex.query(
      "branches:getBranchByOrgSlugProjectSlugAndBranchName" as any,
      {
        orgSlug: parsed.orgSlug,
        projectSlug: parsed.projectSlug,
        branchName: parsed.branchName,
      }
    );

    if (!branch) {
      return c.html(
        `<html><body><h1>Branch Not Found</h1><p>No branch found: ${parsed.orgSlug}/${parsed.projectSlug}/${parsed.branchName}</p></body></html>`,
        404,
      );
    }

    if (!branch.sandboxDomain || !branch.sandboxPreviewToken) {
      return c.html(
        `<html><body><h1>Preview Not Available</h1><p>This branch doesn't have a preview URL yet.</p></body></html>`,
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
      `<html><body><h1>Proxy Error</h1><p>${error instanceof Error ? error.message : "Unknown error"}</p></body></html>`,
      500,
    );
  }
});

export default app;
