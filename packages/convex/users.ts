import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/**
 * Internal helper to get user by Clerk ID
 */
async function getUserByClerkId(ctx: any, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
    .first();
}

/**
 * Upsert user from Clerk webhook data
 * This is called by the webhook endpoint to sync user data
 */
export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existingUser = await getUserByClerkId(ctx, args.clerkId);

    const name = [args.firstName, args.lastName]
      .filter(Boolean)
      .join(" ") || "User";

    const userData = {
      clerkId: args.clerkId,
      name,
      email: args.email,
      imageUrl: args.imageUrl,
      updatedAt: Date.now(),
    };

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, userData);
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        ...userData,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Get user by Clerk ID
 */
export const getByClerkId = query({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await getUserByClerkId(ctx, args.clerkId);
  },
});

/**
 * Get current authenticated user's profile
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
      imageUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }

    return await getUserByClerkId(ctx, identity.subject);
  },
});
