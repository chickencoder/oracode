import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ExternalLinkIcon,
  Loader2Icon,
  PlusCircleIcon,
  FileEditIcon,
  FileQuestionIcon,
  TrashIcon,
  CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PublishPopoverProps {
  branchId: Id<"branches">;
}

export function PublishPopover({ branchId }: PublishPopoverProps) {
  const [open, setOpen] = useState(false);

  // Queries
  const snapshot = useQuery(
    api.snapshots.getSnapshotByBranch,
    branchId ? { branchId } : "skip",
  );

  const branch = useQuery(
    api.branches.getBranchById,
    branchId ? { branchId } : "skip",
  );

  // Actions & Mutations
  const commitAndPublish = useAction(api.githubActions.commitAndPublish);
  const updatePublishStatus = useMutation(api.branches.updatePublishStatus);

  const hasUncommittedChanges = snapshot?.hasUncommittedChanges ?? false;
  const publishStatus = branch?.publishStatus;
  const isPublishing = publishStatus && publishStatus.stage !== "complete";
  const hasPullRequest =
    !!branch?.pullRequestUrl || !!publishStatus?.pullRequestUrl;
  const pullRequestUrl =
    branch?.pullRequestUrl || publishStatus?.pullRequestUrl;

  const handleCommitAndPublish = async () => {
    try {
      // Immediately set loading state for instant feedback
      await updatePublishStatus({
        branchId,
        status: {
          stage: "staging",
          message: "Staging changes...",
        },
      });

      await commitAndPublish({ branchId });
    } catch (error) {
      console.error("Failed to publish:", error);
      toast.error("Failed to publish changes");
      // Clear status on error
      await updatePublishStatus({ branchId, status: null });
    }
  };

  // Clear publish status and show toast when complete
  useEffect(() => {
    if (publishStatus?.stage === "complete") {
      if (publishStatus.error) {
        toast.error(publishStatus.error);
      } else {
        toast.success("Published successfully!");
      }
      // Clear status immediately
      updatePublishStatus({ branchId, status: null });
    }
  }, [publishStatus, branchId, updatePublishStatus]);

  // Determine which stages to show based on whether we're creating a PR
  const willCreatePR = !hasPullRequest;
  const stages = willCreatePR
    ? [
        { key: "staging", label: "Staging changes" },
        { key: "committing", label: "Creating commit" },
        { key: "pushing", label: "Pushing to remote" },
        { key: "creating-pr", label: "Opening pull request" },
      ]
    : [
        { key: "staging", label: "Staging changes" },
        { key: "committing", label: "Creating commit" },
        { key: "pushing", label: "Pushing to remote" },
      ];

  const currentStageIndex = stages.findIndex(
    (s) => s.key === publishStatus?.stage,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" loading={!open && isPublishing}>
          Publish
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          {/* Header */}
          <h3 className="font-medium text-base tracking-tight">
            Publish changes
          </h3>

          {/* Git Status */}
          {snapshot && (
            <div className="space-y-2">
              <div className="text-xs space-y-1.5">
                {snapshot.staged.length > 0 && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <PlusCircleIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {snapshot.staged.length} staged
                    </span>
                  </div>
                )}
                {snapshot.modified.length > 0 && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <FileEditIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {snapshot.modified.length} modified
                    </span>
                  </div>
                )}
                {snapshot.untracked.length > 0 && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <FileQuestionIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {snapshot.untracked.length} untracked
                    </span>
                  </div>
                )}
                {snapshot.deleted.length > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {snapshot.deleted.length} deleted
                    </span>
                  </div>
                )}
                {!hasUncommittedChanges && (
                  <div className="text-muted-foreground inline-flex items-center gap-2">
                    All changes have been published
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {publishStatus && publishStatus.stage !== "complete" && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Publishing progress...
              </h4>
              <div className="space-y-1">
                {stages.map((stage, index) => {
                  const isCurrent = stage.key === publishStatus.stage;
                  const isComplete = index < currentStageIndex;
                  const isActive = index <= currentStageIndex;

                  return (
                    <div
                      key={stage.key}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {isComplete ? (
                        <CheckIcon className="h-3 w-3 text-green-600" />
                      ) : isCurrent ? (
                        <Loader2Icon className="h-3 w-3 animate-spin" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border border-muted" />
                      )}
                      <span>{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isPublishing && (
            <div className="space-y-2">
              {hasUncommittedChanges && (
                <Button
                  onClick={handleCommitAndPublish}
                  className="w-full"
                  size="sm"
                >
                  Publish
                </Button>
              )}

              {!hasUncommittedChanges && !hasPullRequest && (
                <div className="text-xs text-muted-foreground">
                  <p>No changes to publish</p>
                </div>
              )}

              {pullRequestUrl && (
                <Button asChild className="w-full" variant="outline" size="sm">
                  <a
                    href={pullRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    View pull request
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
