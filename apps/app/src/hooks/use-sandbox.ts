import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/clerk-react";

export function useSandbox(branchId: Id<"branches"> | null | undefined) {
  const { organization } = useOrganization();
  const creationInProgress = useRef(false);
  const hasAttempted = useRef(false);

  // Query branch directly (includes sandbox fields)
  // Skip if no branchId or no organization loaded yet
  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId } : "skip",
  );

  const startSandboxAction = useAction(api.sandboxActions.startSandbox);
  const retrySandboxAction = useAction(api.sandboxActions.retrySandbox);

  // Auto-create or auto-restart sandbox
  useEffect(() => {
    if (!branchId || !branch || creationInProgress.current) return;

    // Don't auto-retry if there's an error - user must manually retry
    if (branch.sandboxStatus === "error") {
      hasAttempted.current = true;
      return;
    }

    // If no sandbox exists and we haven't attempted yet, create one
    if (!branch.sandboxId && !hasAttempted.current) {
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

    // If sandbox exists but stopped/archived, restart it automatically
    const shouldRestart =
      branch.sandboxId &&
      branch.sandboxState !== "started" &&
      branch.sandboxStatus !== "creating";

    if (shouldRestart) {
      creationInProgress.current = true;
      retrySandboxAction({ branchId })
        .then(() => {
          creationInProgress.current = false;
        })
        .catch((error) => {
          console.error("Failed to restart sandbox:", error);
          creationInProgress.current = false;
        });
    }
  }, [branchId, branch, startSandboxAction, retrySandboxAction]);

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

  // Sandbox is ready when status is "ready", state is "started", and has domain
  const isReady =
    branch?.sandboxStatus === "ready" &&
    branch?.sandboxState === "started" &&
    !!branch?.sandboxDomain;

  // Build preview URL with authentication token
  const previewUrl = branch?.sandboxDomain
    ? branch.sandboxPreviewToken
      ? `${branch.sandboxDomain}?token=${branch.sandboxPreviewToken}`
      : branch.sandboxDomain
    : "";

  return {
    sandbox: branch, // For backwards compatibility
    isCreating: branch?.sandboxStatus === "creating",
    isReady,
    isStopped: branch?.sandboxState === "stopped",
    isArchived: branch?.sandboxState === "archived",
    hasError: branch?.sandboxStatus === "error",
    domain: branch?.sandboxDomain || "",
    previewUrl, // Use this for iframe src
    error: branch?.sandboxError,
    loadingStage: branch?.sandboxLoadingStage,
    retrySandbox,
  };
}
