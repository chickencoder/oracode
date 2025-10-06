import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect } from "react";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useQuery(
    api.sessions.getSessionById,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip"
  );

  useEffect(() => {
    if (session === null) {
      // Session not found, redirect back
      navigate(-1);
    }
  }, [session, navigate]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b p-4">
        <h1 className="text-lg font-semibold">Session {sessionId}</h1>
        <p className="text-sm text-muted-foreground">
          Created {new Date(session.createdAt).toLocaleString()}
        </p>
      </header>
      <main className="flex-1 p-4">
        <div className="text-center text-muted-foreground">
          Session content will go here
        </div>
      </main>
    </div>
  );
}
