import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/clerk-react";

export function useSandbox(sessionId: Id<"sessions"> | null | undefined) {
  const { organization } = useOrganization();
  const creationInProgress = useRef(false);

  // Query session directly (includes sandbox fields)
  const session = useQuery(
    api.sessions.getSessionById,
    sessionId && organization ? { sessionId } : "skip",
  );

  const startSandboxAction = useAction(api.sandboxActions.startSandbox);
  const retrySandboxAction = useAction(api.sandboxActions.retrySandbox);

  // Auto-create sandbox if needed (only when undefined/null or timed out, NOT on error)
  useEffect(() => {
    if (!sessionId || !session || creationInProgress.current) return;

    const needsSandbox =
      !session.sandboxStatus ||
      (session.sandboxStatus === "ready" && session.isTimedOut);

    if (needsSandbox) {
      creationInProgress.current = true;
      console.log("Auto-creating sandbox for session:", sessionId);
      startSandboxAction({ sessionId })
        .then((result) => {
          console.log("Sandbox created:", result);
          creationInProgress.current = false;
        })
        .catch((error) => {
          console.error("Failed to create sandbox:", error);
          creationInProgress.current = false;
        });
    }
  }, [sessionId, session?.sandboxStatus, session?.isTimedOut, startSandboxAction]);

  const retrySandbox = () => {
    if (!sessionId || creationInProgress.current) return;
    creationInProgress.current = true;
    console.log("Retrying sandbox for session:", sessionId);
    retrySandboxAction({ sessionId })
      .then((result) => {
        console.log("Sandbox retry succeeded:", result);
        creationInProgress.current = false;
      })
      .catch((error) => {
        console.error("Sandbox retry failed:", error);
        creationInProgress.current = false;
      });
  };

  // Sandbox is only truly ready when status is "ready", has domain, and not timed out
  const isReady =
    session?.sandboxStatus === "ready" &&
    !!session?.sandboxDomain &&
    !session?.isTimedOut;

  return {
    sandbox: session, // For backwards compatibility
    isCreating: session?.sandboxStatus === "creating",
    isReady,
    hasError: session?.sandboxStatus === "error",
    isTimedOut: session?.isTimedOut || false,
    domain: session?.sandboxDomain || "",
    error: session?.sandboxError,
    loadingStage: session?.sandboxLoadingStage,
    retrySandbox,
  };
}
