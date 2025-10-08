import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/hooks/use-projects";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { History } from "lucide-react";

interface NewSessionDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSessionDialog({
  project,
  open,
  onOpenChange,
}: NewSessionDialogProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const createSession = useMutation(api.sessions.createSession);
  const sessions = useQuery(
    api.sessions.getSessionsByProject,
    project ? { projectId: project._id } : "skip",
  );

  const handleCreateSession = async () => {
    if (!project) return;

    setIsCreating(true);
    try {
      const sessionId = await createSession({ projectId: project._id });
      navigate(`/${orgSlug}/sessions/${sessionId}`);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSessionClick = (sessionId: Id<"sessions">) => {
    navigate(`/${orgSlug}/sessions/${sessionId}`);
    onOpenChange(false);
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Button
            onClick={handleCreateSession}
            loading={isCreating}
            className="w-full"
            size="lg"
          >
            New session
          </Button>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Recent Sessions</h3>
            <ScrollArea className="h-[256px] p-0">
              {sessions === undefined ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="rounded-md p-4">
                      <CardHeader className="p-0">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <Card
                      key={session._id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors rounded-md p-4"
                      onClick={() => handleSessionClick(session._id)}
                    >
                      <CardHeader className="p-0">
                        <CardTitle className="text-sm font-medium">
                          Untitled
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {formatDistanceToNow(session.createdAt, {
                            addSuffix: true,
                          })}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty className="border border-dashed h-[256px]">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <History />
                    </EmptyMedia>
                    <EmptyTitle>No sessions found</EmptyTitle>
                    <EmptyDescription>
                      Start your first session above.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
