import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc, adminAc, memberAc } from "better-auth/plugins/organization/access";

const siteUrl = process.env.SITE_URL!;

// Define access control statements for projects
const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
} as const;

// Create access control instance
export const ac = createAccessControl(statement);

// Define roles with project permissions
export const owner = ac.newRole({
  project: ["create", "read", "update", "delete"],
  ...ownerAc.statements,
});

export const admin = ac.newRole({
  project: ["create", "read", "update", "delete"],
  ...adminAc.statements,
});

export const member = ac.newRole({
  project: ["read"],
  ...memberAc.statements,
});

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  return betterAuth({
    // disable logging when createAuth is called just to generate options.
    // this is not required, but there's a lot of noise in logs without it.
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        scope: ["user:email", "repo"],
      },
    },
    plugins: [
      convex(),
      organization({
        ac,
        roles: {
          owner,
          admin,
          member,
        },
      }),
    ],
  });
};

/**
 * Check if the current user has the specified permissions for a project within an organization
 * @param ctx - Convex context (query or mutation)
 * @param orgId - Organization ID
 * @param projectId - Project ID (optional, used for additional validation)
 * @param permissions - Array of permission actions to check (e.g., ["read"], ["create", "update"])
 * @throws Error if user is unauthorized
 * @returns true if authorized
 */
export async function checkProjectPermission(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  projectId: string | null,
  permissions: ("create" | "read" | "update" | "delete")[]
) {
  const hasPermission = await createAuth(ctx).api.hasPermission({
    headers: await authComponent.getHeaders(ctx),
    body: {
      permission: {
        project: permissions,
      },
    },
  });

  if (!hasPermission.success) {
    throw new Error("Unauthorized: Insufficient permissions for this project");
  }

  return true;
}

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
