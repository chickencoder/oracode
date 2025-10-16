import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";

export function useSandbox(branchId: Id<"branches"> | null | undefined) {
  const { organization } = useOrganization();

  // Query branch state
  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId } : "skip",
  );

  // Single orchestrator action
  const pingSandbox = useAction(api.sandboxActions.pingSandbox);

  // Track if we're currently pinging
  const [isPinging, setIsPinging] = useState(false);

  // Ping sandbox when state indicates it needs attention
  useEffect(() => {
    if (!branchId || !branch || isPinging) return;

    // Determine if sandbox needs action
    const needsAction =
      !branch.sandboxId || // No sandbox yet
      branch.sandboxState === "stopped" || // Stopped by Daytona
      branch.sandboxState === "archived" || // Archived
      branch.sandboxStatus === "error"; // In error state

    if (needsAction) {
      setIsPinging(true);
      pingSandbox({ branchId })
        .catch((error) => {
          console.error("Failed to ping sandbox:", error);
        })
        .finally(() => {
          setIsPinging(false);
        });
    }
  }, [branchId, branch, isPinging, pingSandbox]);

  // Manual retry for user-initiated actions
  const retrySandbox = () => {
    if (!branchId || isPinging) return;

    setIsPinging(true);
    pingSandbox({ branchId })
      .catch((error) => {
        console.error("Failed to retry sandbox:", error);
      })
      .finally(() => {
        setIsPinging(false);
      });
  };

  // Compute derived state
  const isStopped =
    branch?.sandboxState === "stopped" || branch?.sandboxState === "archived";
  const isReady =
    branch?.sandboxStatus === "ready" &&
    branch?.sandboxState === "started" &&
    !!branch?.sandboxDomain;
  const previewUrl = branchId
    ? `http://preview-${branchId}.oracode.local`
    : "";

  return {
    sandbox: branch,
    isCreating: branch?.sandboxStatus === "creating" || isPinging,
    isReady,
    isStopped,
    isArchived: branch?.sandboxState === "archived",
    hasError: branch?.sandboxStatus === "error",
    domain: branch?.sandboxDomain || "",
    previewUrl,
    error: branch?.sandboxError,
    loadingStage: branch?.sandboxLoadingStage,
    retrySandbox,
  };
}
