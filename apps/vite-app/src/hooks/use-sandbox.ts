import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";

export function useSandbox(sessionId: Id<"sessions"> | null | undefined) {
  const { organization } = useOrganization();
  const [isCreating, setIsCreating] = useState(false);

  const sandbox = useQuery(
    api.sandboxes.getSandboxBySession,
    sessionId && organization ? { sessionId } : "skip",
  );

  const startSandboxAction = useAction(api.sandboxActions.startSandbox);
  const retrySandboxAction = useAction(api.sandboxActions.retrySandbox);

  // Auto-create sandbox if needed (only when null or timed out, NOT on error)
  useEffect(() => {
    const shouldCreateSandbox =
      sessionId && !isCreating && (sandbox === null || sandbox?.isTimedOut);

    if (shouldCreateSandbox) {
      setIsCreating(true);
      console.log("Auto-creating sandbox for session:", sessionId);
      startSandboxAction({ sessionId })
        .then((result) => {
          console.log("Sandbox created:", result);
          setIsCreating(false);
        })
        .catch((error) => {
          console.error("Failed to create sandbox:", error);
          setIsCreating(false);
        });
    }
  }, [sessionId, sandbox, isCreating, startSandboxAction]);

  const retrySandbox = () => {
    if (!sessionId || isCreating) return;
    setIsCreating(true);
    console.log("Retrying sandbox for session:", sessionId);
    retrySandboxAction({ sessionId })
      .then((result) => {
        console.log("Sandbox retry succeeded:", result);
        setIsCreating(false);
      })
      .catch((error) => {
        console.error("Sandbox retry failed:", error);
        setIsCreating(false);
      });
  };

  return {
    sandbox,
    isCreating: isCreating || sandbox?.status === "creating",
    isReady: sandbox?.status === "ready" && !sandbox?.isTimedOut,
    hasError: sandbox?.status === "error",
    isTimedOut: sandbox?.isTimedOut || false,
    domain: sandbox?.status === "ready" ? sandbox.domain : "",
    error: sandbox?.error,
    loadingStage: sandbox?.loadingStage,
    retrySandbox,
  };
}
