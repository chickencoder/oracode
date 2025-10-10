import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { History, SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ProjectSessionsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useQueryState("q", { defaultValue: "" });
  const [isCreating, setIsCreating] = useState(false);

  const createSession = useMutation(api.sessions.createSession);
  const sessions = useQuery(
    api.sessions.getSessionsByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const handleCreateSession = async () => {
    if (!projectId) return;

    setIsCreating(true);
    try {
      const sessionId = await createSession({ projectId: projectId as Id<"projects"> });
      navigate(`/${orgSlug}/sessions/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSessionClick = (sessionId: Id<"sessions">) => {
    navigate(`/${orgSlug}/sessions/${sessionId}`);
  };

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!sessions || !search) return sessions;

    const query = search.toLowerCase();
    // For now, just return all sessions since we don't have searchable fields
    // In the future, could filter by session name/title when added
    return sessions;
  }, [sessions, search]);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <InputGroup className="max-w-72 bg-card">
          <InputGroupInput
            placeholder="Search sessions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>

        <Button
          onClick={handleCreateSession}
          loading={isCreating}
        >
          New Session
        </Button>
      </div>

      {sessions === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredSessions && filteredSessions.length > 0 ? (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <Card
              key={session._id}
              className="cursor-pointer hover:bg-accent/50 transition-colors rounded-md shadow-xs"
              onClick={() => handleSessionClick(session._id)}
            >
              <CardHeader>
                <CardTitle className="font-medium tracking-tight text-lg">
                  Untitled
                </CardTitle>
                <CardDescription className="text-sm">
                  {formatDistanceToNow(session.createdAt, {
                    addSuffix: true,
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="border border-dashed min-h-[500px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No sessions found</EmptyTitle>
            <EmptyDescription>
              {search
                ? `No sessions found matching "${search}"`
                : "Create a new session to get started"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </main>
  );
}
