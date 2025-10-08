import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { useSandbox } from "@/hooks/use-sandbox";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isLoaded } = useAuth();

  const session = useQuery(
    api.sessions.getSessionById,
    sessionId && isLoaded ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );

  const { domain, hasError, error, isCreating, loadingStage, isReady, retrySandbox } =
    useSandbox(sessionId ? (sessionId as Id<"sessions">) : null);

  useEffect(() => {
    if (session === null) {
      // Session not found or not authorized, redirect back
      navigate(-1);
    }
  }, [session, navigate]);

  // Always render UI immediately - child components handle their own loading states
  return (
    <div className="h-dvh flex flex-col gap-2 p-2">
      <div className="flex gap-2 flex-1 min-h-0">
        <ChatPanel
          sessionId={sessionId as Id<"sessions">}
          isSandboxReady={isReady}
        />
        <PreviewPanel
          domain={domain}
          hasError={hasError}
          error={error}
          isCreating={isCreating}
          loadingStage={loadingStage}
          onRetry={retrySandbox}
        />
      </div>
    </div>
  );
}
