import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect } from "react";
import { ConversationPanel } from "@/components/conversation-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { useSandbox } from "@/hooks/use-sandbox";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useQuery(
    api.sessions.getSessionById,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );

  const { domain } = useSandbox(
    sessionId ? (sessionId as Id<"sessions">) : null,
  );

  useEffect(() => {
    if (session === null) {
      // Session not found or not authorized, redirect back
      navigate(-1);
    }
  }, [session, navigate]);

  // Show loading state while session is being fetched
  if (session === undefined) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  // Session will either be valid or we'll redirect, so we can safely render
  if (!sessionId) {
    return null;
  }

  return (
    <div className="h-dvh flex gap-2 p-2">
      <ConversationPanel sessionId={sessionId as Id<"sessions">} />
      <PreviewPanel domain={domain} />
    </div>
  );
}
