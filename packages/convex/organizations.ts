import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/**
 * Internal helper to get organization by Clerk org ID
 */
async function getOrgByClerkId(ctx: any, clerkOrgId: string) {
  return await ctx.db
    .query("orgs")
    .withIndex("by_org_id", (q: any) => q.eq("orgId", clerkOrgId))
    .first();
}

/**
 * Upsert organization from Clerk webhook data
 * This is called by the webhook endpoint to sync org data
 */
export const upsertFromClerk = internalMutation({
  args: {
    clerkOrgId: v.string(),
    slug: v.string(),
    name: v.string(),
  },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    const existingOrg = await getOrgByClerkId(ctx, args.clerkOrgId);

    const orgData = {
      orgId: args.clerkOrgId,
      slug: args.slug,
      name: args.name,
    };

    if (existingOrg) {
      // Update existing organization
      await ctx.db.patch(existingOrg._id, orgData);
      return existingOrg._id;
    } else {
      // Create new organization
      return await ctx.db.insert("orgs", orgData);
    }
  },
});

/**
 * Get organization by slug
 */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("orgs"),
      _creationTime: v.number(),
      orgId: v.string(),
      slug: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get organization by Clerk org ID
 */
export const getByClerkId = query({
  args: { clerkOrgId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("orgs"),
      _creationTime: v.number(),
      orgId: v.string(),
      slug: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await getOrgByClerkId(ctx, args.clerkOrgId);
  },
});
