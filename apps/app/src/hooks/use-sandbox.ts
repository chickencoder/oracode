import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";

/**
 * Generate URL-friendly slug from a name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export function useSandbox(branchId: Id<"branches"> | null | undefined) {
  const { organization } = useOrganization();

  // Query branch state
  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId } : "skip",
  );

  // Query project to get slug
  const project = useQuery(
    api.projects.getProjectById,
    branch ? { projectId: branch.projectId } : "skip",
  );

  // Query organization to get slug
  const org = useQuery(
    api.organizations.getByClerkId,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  // Single orchestrator action
  const pingSandbox = useAction(api.sandboxActions.pingSandbox);

  // Track if we're currently pinging
  const [isPinging, setIsPinging] = useState(false);

  // Ping sandbox when status indicates it needs attention
  useEffect(() => {
    if (!branchId || !branch || isPinging) return;

    // Determine if sandbox needs action
    const needsAction =
      !branch.sandboxId || // No sandbox yet
      branch.sandboxStatus === "stopped" || // Stopped by Daytona
      branch.sandboxStatus === "archived" || // Archived
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
    branch?.sandboxStatus === "stopped" || branch?.sandboxStatus === "archived";
  const isReady =
    branch?.sandboxStatus === "running" && !!branch?.sandboxDomain;

  // Build preview URL - only when sandbox domain and token are available
  // Format: {orgSlug}-team-{projectSlug}-git-{branch}.oracode.dev (or .local for dev)
  const hasPreviewReady =
    branch?.sandboxDomain && branch?.sandboxPreviewToken;
  const hasRequiredData = branch && project?.slug && org?.slug;

  const host =
    process.env.NODE_ENV === "production" ? "oracode.dev" : "oracode.local";

  const previewUrl =
    hasPreviewReady && hasRequiredData
      ? `https://${org.slug}-team-${project.slug}-git-${slugify(branch.branchName)}.${host}`
      : "";

  return {
    sandbox: branch,
    isCreating: branch?.sandboxStatus === "provisioning" || branch?.sandboxStatus === "starting" || isPinging,
    isReady,
    isStopped,
    isArchived: branch?.sandboxStatus === "archived",
    hasError: branch?.sandboxStatus === "error",
    domain: branch?.sandboxDomain || "",
    previewUrl,
    error: branch?.sandboxError,
    loadingStage: branch?.sandboxLoadingStage,
    retrySandbox,
  };
}
