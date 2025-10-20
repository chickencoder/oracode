import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Internal mutation to handle sandbox status changes from Daytona webhooks
export const handleSandboxStateChange = internalMutation({
  args: {
    sandboxId: v.string(),
    event: v.string(),
    state: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("archived")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log("=== handleSandboxStateChange ===");
    console.log("Sandbox ID:", args.sandboxId);
    console.log("Event:", args.event);
    console.log("Status:", args.state);

    // Find the branch with this sandbox ID
    const branch = await ctx.db
      .query("branches")
      .withIndex("by_sandbox_id", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    if (!branch) {
      console.warn("No branch found for sandbox:", args.sandboxId);
      return null;
    }

    console.log("Found branch:", branch._id);

    // Update the sandbox status in the branch
    await ctx.db.patch(branch._id, {
      sandboxStatus: args.state,
    });

    console.log("Updated branch sandbox status to:", args.state);

    // Note: Auto-resume is handled client-side in use-sandbox.ts hook
    // The hook will detect the stopped status and trigger resume when the user views the branch

    return null;
  },
});
