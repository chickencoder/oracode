import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id, Doc } from "@repo/convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/clerk-react";

// Helper: Determine if sandbox is stopped (trust aliveUntil as source of truth)
function isSandboxStopped(branch: Doc<"branches"> | null | undefined): boolean {
  if (!branch?.sandboxId) return false;

  // Past aliveUntil timestamp = definitely stopped (regardless of sandboxState)
  if (branch.sandboxAliveUntil && Date.now() > branch.sandboxAliveUntil) {
    return true;
  }

  // Explicitly stopped or archived
  return (
    branch.sandboxState === "stopped" || branch.sandboxState === "archived"
  );
}

export function useSandbox(branchId: Id<"branches"> | null | undefined) {
  const { organization } = useOrganization();
  const creationInProgress = useRef(false);
  const hasAttempted = useRef(false);
  const lastBranchId = useRef<Id<"branches"> | null | undefined>(undefined);

  // Query branch directly (includes sandbox fields)
  // Skip if no branchId or no organization loaded yet
  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId } : "skip",
  );

  // Reset attempt flag when branch changes
  useEffect(() => {
    if (branchId !== lastBranchId.current) {
      hasAttempted.current = false;
      lastBranchId.current = branchId;
    }
  }, [branchId]);

  const startSandboxAction = useAction(api.sandboxActions.startSandbox);
  const retrySandboxAction = useAction(api.sandboxActions.retrySandbox);
  const resumeSandboxAction = useAction(api.sandboxActions.resumeSandbox);

  // Auto-create or auto-resume sandbox
  useEffect(() => {
    if (
      !branchId ||
      !branch ||
      creationInProgress.current ||
      hasAttempted.current
    )
      return;

    // Don't auto-retry if there's an error - user must manually retry
    if (branch.sandboxStatus === "error") {
      hasAttempted.current = true;
      return;
    }

    // Don't auto-retry if currently creating
    if (branch.sandboxStatus === "creating") {
      return;
    }

    // Case 1: No sandbox exists yet - create one
    if (!branch.sandboxId) {
      console.log("No sandbox found, creating...");
      creationInProgress.current = true;
      hasAttempted.current = true;
      startSandboxAction({ branchId })
        .then(() => {
          creationInProgress.current = false;
        })
        .catch((error) => {
          console.error("Failed to create sandbox:", error);
          creationInProgress.current = false;
        });
      return;
    }

    // Case 2: Sandbox exists but is stopped (either timed out or explicitly stopped)
    const stopped = isSandboxStopped(branch);
    if (stopped) {
      // Archived sandboxes need full restart, others can be resumed
      const action =
        branch.sandboxState === "archived"
          ? retrySandboxAction
          : resumeSandboxAction;
      const actionName =
        branch.sandboxState === "archived" ? "restarting" : "resuming";

      console.log(`Sandbox is stopped, ${actionName}...`);
      creationInProgress.current = true;
      hasAttempted.current = true;
      action({ branchId })
        .then(() => {
          creationInProgress.current = false;
        })
        .catch((error) => {
          console.error(`Failed to ${actionName.slice(0, -3)} sandbox:`, error);
          creationInProgress.current = false;
        });
    }
  }, [
    branchId,
    branch,
    startSandboxAction,
    resumeSandboxAction,
    retrySandboxAction,
  ]);

  const retrySandbox = () => {
    if (!branchId || !branch || creationInProgress.current) return;
    creationInProgress.current = true;
    hasAttempted.current = false; // Reset attempt flag for manual retry

    // If no sandboxId exists, create new sandbox, otherwise restart existing
    const action = branch.sandboxId ? retrySandboxAction : startSandboxAction;

    action({ branchId })
      .then(() => {
        creationInProgress.current = false;
      })
      .catch((error) => {
        console.error("Sandbox retry failed:", error);
        creationInProgress.current = false;
        hasAttempted.current = true; // Set flag again to prevent auto-retry loop
      });
  };

  const stopped = isSandboxStopped(branch);

  // Sandbox is ready when status is "ready", has domain, and not stopped
  const isReady =
    branch?.sandboxStatus === "ready" && !!branch?.sandboxDomain && !stopped;

  // Build preview URL using local proxy service
  // Format: http://branchId.preview.oracode.local
  const previewUrl = branchId ? `http://${branchId}.preview.oracode.local` : "";

  return {
    sandbox: branch, // For backwards compatibility
    isCreating: branch?.sandboxStatus === "creating",
    isReady,
    isStopped: stopped,
    isArchived: branch?.sandboxState === "archived",
    hasError: branch?.sandboxStatus === "error",
    domain: branch?.sandboxDomain || "", // Raw Daytona URL for debugging
    previewUrl, // Proxy URL for iframe src
    error: branch?.sandboxError,
    loadingStage: branch?.sandboxLoadingStage,
    retrySandbox,
  };
}
