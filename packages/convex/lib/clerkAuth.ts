"use node";

import { createClerkClient } from "@clerk/backend";

/**
 * Generate a Clerk JWT token for Convex authentication from a user's active session
 * Token is generated using the "convex" JWT template
 * Token lifetime is determined by the JWT template configuration in Clerk Dashboard
 * (should be set to 1 hour to match sandbox timeout duration)
 */
export async function generateClerkTokenForConvex(
  userId: string,
  orgId?: string,
): Promise<string> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });

  // Get the user's active sessions
  const sessionsResponse = await clerk.sessions.getSessionList({
    userId,
    status: "active",
  });

  if (!sessionsResponse.data || sessionsResponse.data.length === 0) {
    throw new Error("No active Clerk session found for user");
  }

  // Find a session with the matching organization, or use the first active session
  let sessionId: string;
  if (orgId) {
    const orgSession = sessionsResponse.data.find(
      (session) => session.lastActiveOrganizationId === orgId
    );
    sessionId = orgSession?.id || sessionsResponse.data[0].id;
  } else {
    sessionId = sessionsResponse.data[0].id;
  }

  // Generate a JWT token from the session using the "convex" template
  // The template name must match the JWT template configured in Clerk Dashboard
  const tokenResponse = await clerk.sessions.getToken(sessionId, "convex");

  // The response is an object with a 'jwt' property
  if (
    !tokenResponse ||
    typeof tokenResponse !== "object" ||
    !("jwt" in tokenResponse) ||
    typeof tokenResponse.jwt !== "string"
  ) {
    throw new Error("Failed to generate Clerk token for Convex");
  }

  return tokenResponse.jwt;
}
