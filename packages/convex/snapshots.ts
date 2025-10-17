import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Shared snapshot return type validator
const snapshotReturnType = v.object({
  _id: v.id("snapshots"),
  _creationTime: v.number(),
  branchId: v.id("branches"),
  currentBranch: v.string(),
  headCommit: v.string(),
  hasUncommittedChanges: v.boolean(),
  staged: v.array(v.string()),
  modified: v.array(v.string()),
  untracked: v.array(v.string()),
  deleted: v.array(v.string()),
});

// Upsert snapshot for a branch (update if exists, insert if not)
export const updateSnapshot = mutation({
  args: {
    branchId: v.id("branches"),
    currentBranch: v.string(),
    headCommit: v.string(),
    hasUncommittedChanges: v.boolean(),
    staged: v.array(v.string()),
    modified: v.array(v.string()),
    untracked: v.array(v.string()),
    deleted: v.array(v.string()),
  },
  returns: v.id("snapshots"),
  handler: async (ctx, args) => {
    // Try to find existing snapshot for this branch
    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .unique();

    if (existing) {
      // Update existing snapshot
      await ctx.db.patch(existing._id, {
        currentBranch: args.currentBranch,
        headCommit: args.headCommit,
        hasUncommittedChanges: args.hasUncommittedChanges,
        staged: args.staged,
        modified: args.modified,
        untracked: args.untracked,
        deleted: args.deleted,
      });
      return existing._id;
    } else {
      // Insert new snapshot
      return await ctx.db.insert("snapshots", {
        branchId: args.branchId,
        currentBranch: args.currentBranch,
        headCommit: args.headCommit,
        hasUncommittedChanges: args.hasUncommittedChanges,
        staged: args.staged,
        modified: args.modified,
        untracked: args.untracked,
        deleted: args.deleted,
      });
    }
  },
});

// Get snapshot for a branch
export const getSnapshotByBranch = query({
  args: {
    branchId: v.id("branches"),
  },
  returns: v.union(snapshotReturnType, v.null()),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("snapshots")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .unique();

    return snapshot || null;
  },
});
