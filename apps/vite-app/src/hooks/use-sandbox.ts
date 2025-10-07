import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useState } from "react";

export function useSandbox(sessionId: Id<"sessions"> | null | undefined) {
  const [isCreating, setIsCreating] = useState(false);

  const sandbox = useQuery(
    api.sandboxes.getSandboxBySession,
    sessionId ? { sessionId } : "skip",
  );

  const startSandbox = useAction(api.sandboxes.startSandbox);

  // Auto-create sandbox if needed
  useEffect(() => {
    const shouldCreateSandbox =
      sessionId &&
      !isCreating &&
      (sandbox === null ||
        sandbox.status === "timeout" ||
        sandbox.status === "error" ||
        sandbox.isTimedOut);

    if (shouldCreateSandbox) {
      setIsCreating(true);
      console.log("Auto-creating sandbox for session:", sessionId);
      startSandbox({ sessionId })
        .then((result) => {
          console.log("Sandbox created:", result);
          setIsCreating(false);
        })
        .catch((error) => {
          console.error("Failed to create sandbox:", error);
          setIsCreating(false);
        });
    }
  }, [sessionId, sandbox, isCreating, startSandbox]);

  const retrySandbox = () => {
    if (!sessionId || isCreating) return;
    setIsCreating(true);
    startSandbox({ sessionId })
      .then(() => setIsCreating(false))
      .catch(() => setIsCreating(false));
  };

  return {
    sandbox,
    isCreating: isCreating || sandbox?.status === "creating",
    isReady: sandbox?.status === "ready" && !sandbox?.isTimedOut,
    hasError: sandbox?.status === "error",
    isTimedOut: sandbox?.isTimedOut || false,
    domain: sandbox?.status === "ready" ? sandbox.domain : "",
    error: sandbox?.error,
    retrySandbox,
  };
}
