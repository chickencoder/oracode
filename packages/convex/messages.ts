import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getLastUserMessage = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
      userId: v.string(),
      orgId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    const lastUserMessage = await ctx.db
      .query("messages")
      .withIndex("by_org_and_session", (q) =>
        q.eq("orgId", orgId).eq("sessionId", args.sessionId)
      )
      .filter((q) => q.eq(q.field("role"), "user"))
      .order("desc")
      .first();

    if (!lastUserMessage) {
      return null;
    }

    // Check if there are any assistant messages after this user message in the same session
    const assistantMessageAfter = await ctx.db
      .query("messages")
      .withIndex("by_org_and_session", (q) =>
        q.eq("orgId", orgId).eq("sessionId", args.sessionId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "assistant"),
          q.gt(q.field("_creationTime"), lastUserMessage._creationTime)
        )
      )
      .first();

    // Only return the user message if it hasn't been responded to
    return assistantMessageAfter ? null : lastUserMessage;
  },
});

export const insertAssistantMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || !identity?.subject || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;
    const userId = identity.subject;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    return await ctx.db.insert("messages", {
      id: args.id,
      role: "assistant",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
      userId,
      orgId,
    });
  },
});

export const upsertAssistantMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || !identity?.subject || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;
    const userId = identity.subject;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    // Try to find existing message
    const existingMessage = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (existingMessage) {
      // Update existing message with new parts
      return await ctx.db.patch(existingMessage._id, {
        parts: args.parts,
        metadata: args.metadata,
        sessionId: args.sessionId,
      });
    } else {
      // Insert new message
      return await ctx.db.insert("messages", {
        id: args.id,
        role: "assistant",
        parts: args.parts,
        metadata: args.metadata,
        sessionId: args.sessionId,
        userId,
        orgId,
      });
    }
  },
});

export const insertUserMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || !identity?.subject || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;
    const userId = identity.subject;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    return await ctx.db.insert("messages", {
      id: args.id,
      role: "user",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
      userId,
      orgId,
    });
  },
});

export const getAllMessages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
      userId: v.string(),
      orgId: v.string(),
    })
  ),
  handler: async (ctx) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      return [];
    }
    const orgId = identity.orgId;

    return await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .order("asc")
      .collect();
  },
});


export const getCurrentSessionId = query({
  returns: v.union(v.id("sessions"), v.null()),
  handler: async (ctx) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      return null;
    }
    const orgId = identity.orgId;

    // Get the most recent assistant message, which should have the current sessionId
    const lastAssistantMessage = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("orgId"), orgId),
          q.eq(q.field("role"), "assistant")
        )
      )
      .order("desc")
      .first();

    return lastAssistantMessage?.sessionId || null;
  },
});

export const getMessagesBySessionId = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
      userId: v.string(),
      orgId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.orgId || typeof identity.orgId !== "string") {
      throw new Error("User must be authenticated with an organization");
    }
    const orgId = identity.orgId;

    // Verify session belongs to user's org
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const project = await ctx.db.get(session.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Not authorized to access this session");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_org_and_session", (q) =>
        q.eq("orgId", orgId).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .collect();
  },
});
