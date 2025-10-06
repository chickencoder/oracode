import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getLastUserMessage = query({
  args: {
    projectId: v.id("projects"),
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    // Get last user message
    const lastUserMessage = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("role"), "user"))
      .order("desc")
      .first();

    if (!lastUserMessage) {
      return null;
    }

    // Check if there are any assistant messages after this user message in the same session
    const assistantMessageAfter = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
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
    projectId: v.id("projects"),
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    // Insert message
    return await ctx.db.insert("messages", {
      id: args.id,
      role: "assistant",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
    });
  },
});

export const upsertAssistantMessage = mutation({
  args: {
    projectId: v.id("projects"),
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox) {
      throw new Error("Session sandbox not found");
    }

    const project = await ctx.db.get(sandbox.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: Not your project");
    }

    // Insert user message
    return await ctx.db.insert("messages", {
      id: args.id,
      role: "user",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
    });
  },
});

export const getAllMessages = query({
  args: {
    projectId: v.id("projects"),
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
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Get all messages for sessions belonging to this project
    // Note: This is expensive - consider filtering by sessionId instead
    const allMessages = await ctx.db
      .query("messages")
      .order("asc")
      .collect();

    // Filter to only messages from sessions in this project
    const filteredMessages = [];
    for (const message of allMessages) {
      const session = await ctx.db.get(message.sessionId);
      if (session) {
        const sandbox = await ctx.db.get(session.sandboxId);
        if (sandbox && sandbox.projectId === args.projectId) {
          filteredMessages.push(message);
        }
      }
    }

    return filteredMessages;
  },
});


export const getCurrentSessionId = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(v.id("sessions"), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Get the most recent assistant message in this project
    const allMessages = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("role"), "assistant"))
      .order("desc")
      .collect();

    // Find the first message that belongs to this project
    for (const message of allMessages) {
      const session = await ctx.db.get(message.sessionId);
      if (session) {
        const sandbox = await ctx.db.get(session.sandboxId);
        if (sandbox && sandbox.projectId === args.projectId) {
          return message.sessionId;
        }
      }
    }

    return null;
  },
});

export const getMessagesBySessionId = query({
  args: {
    projectId: v.id("projects"),
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
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      throw new Error("Project not found");
    }

    // Verify session chain
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const sandbox = await ctx.db.get(session.sandboxId);
    if (!sandbox || sandbox.projectId !== args.projectId) {
      throw new Error("Session does not belong to project");
    }

    // Get messages
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
