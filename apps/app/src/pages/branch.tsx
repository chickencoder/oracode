import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { useSandbox } from "@/hooks/use-sandbox";
import { BranchBreadcrumbs } from "@/components/branch-breadcrumbs";
import { Button } from "@/components/ui/button";

export function BranchPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();

  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId: branchId as Id<"branches"> } : "skip",
  );

  const project = useQuery(
    api.projects.getProjectById,
    branch ? { projectId: branch.projectId } : "skip",
  );

  const { previewUrl, hasError, error, isCreating, loadingStage, isReady, retrySandbox } =
    useSandbox(branchId ? (branchId as Id<"branches">) : null);

  useEffect(() => {
    if (branch === null) {
      // Branch not found or not authorized, redirect back
      navigate(-1);
    }
  }, [branch, navigate]);

  // Always render UI immediately - child components handle their own loading states
  return (
    <div className="h-dvh flex flex-col gap-2 p-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <BranchBreadcrumbs
          orgSlug={organization?.slug || ""}
          projectId={branch?.projectId || ""}
          projectName={project?.name}
          branchName={branch?.branchName}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            Share
          </Button>
          <Button size="sm">
            Publish
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-2 flex-1 min-h-0">
        <ChatPanel
          branchId={branchId as Id<"branches">}
          isSandboxReady={isReady}
        />
        <PreviewPanel
          domain={previewUrl}
          hasError={hasError}
          error={error}
          isCreating={isCreating}
          loadingStage={loadingStage}
          onRetry={retrySandbox}
          branchId={branchId as Id<"branches">}
        />
      </div>
    </div>
  );
}
