import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/clerk-react";

export function useSandbox(sessionId: Id<"sessions"> | null | undefined) {
  const { organization } = useOrganization();
  const creationInProgress = useRef(false);
  const hasAttempted = useRef(false);

  // Query session directly (includes sandbox fields)
  // Skip if no sessionId or no organization loaded yet
  const session = useQuery(
    api.sessions.getSessionById,
    sessionId && organization?.id ? { sessionId } : "skip",
  );

  const startSandboxAction = useAction(api.sandboxActions.startSandbox);
  const retrySandboxAction = useAction(api.sandboxActions.retrySandbox);

  // Auto-create or auto-restart sandbox
  useEffect(() => {
    if (!sessionId || !session || creationInProgress.current) return;

    // Don't auto-retry if there's an error - user must manually retry
    if (session.sandboxStatus === "error") {
      hasAttempted.current = true;
      return;
    }

    // If no sandbox exists and we haven't attempted yet, create one
    if (!session.sandboxId && !hasAttempted.current) {
      creationInProgress.current = true;
      hasAttempted.current = true;
      startSandboxAction({ sessionId })
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
      session.sandboxId &&
      session.sandboxState !== "started" &&
      session.sandboxStatus !== "creating";

    if (shouldRestart) {
      creationInProgress.current = true;
      retrySandboxAction({ sessionId })
        .then(() => {
          creationInProgress.current = false;
        })
        .catch((error) => {
          console.error("Failed to restart sandbox:", error);
          creationInProgress.current = false;
        });
    }
  }, [sessionId, session, startSandboxAction, retrySandboxAction]);

  const retrySandbox = () => {
    if (!sessionId || !session || creationInProgress.current) return;
    creationInProgress.current = true;
    hasAttempted.current = false; // Reset attempt flag for manual retry

    // If no sandboxId exists, create new sandbox, otherwise restart existing
    const action = session.sandboxId ? retrySandboxAction : startSandboxAction;

    action({ sessionId })
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
    session?.sandboxStatus === "ready" &&
    session?.sandboxState === "started" &&
    !!session?.sandboxDomain;

  // Build preview URL with authentication token
  const previewUrl = session?.sandboxDomain
    ? session.sandboxPreviewToken
      ? `${session.sandboxDomain}?token=${session.sandboxPreviewToken}`
      : session.sandboxDomain
    : "";

  return {
    sandbox: session, // For backwards compatibility
    isCreating: session?.sandboxStatus === "creating",
    isReady,
    isStopped: session?.sandboxState === "stopped",
    isArchived: session?.sandboxState === "archived",
    hasError: session?.sandboxStatus === "error",
    domain: session?.sandboxDomain || "",
    previewUrl, // Use this for iframe src
    error: session?.sandboxError,
    loadingStage: session?.sandboxLoadingStage,
    retrySandbox,
  };
}
