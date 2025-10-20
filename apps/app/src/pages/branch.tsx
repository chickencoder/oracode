import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { useSandbox } from "@/hooks/use-sandbox";
import { BranchBreadcrumbs } from "@/components/branch-breadcrumbs";
import { Button } from "@/components/ui/button";
import { PublishPopover } from "@/components/publish-popover";
import { useOrgNavigation } from "@/hooks/use-org-navigation";
import { toast } from "sonner";

export function BranchPage() {
  const { orgSlug, projectSlug, branchName } = useParams<{
    orgSlug: string;
    projectSlug: string;
    branchName: string;
  }>();
  const navigate = useNavigate();

  // Ensure the correct org is set based on URL
  const { organization, isLoaded: isOrgLoaded } = useOrgNavigation(orgSlug);

  const branch = useQuery(
    api.branches.getBranchByOrgProjectAndBranchName,
    orgSlug && projectSlug && branchName && organization?.id
      ? { orgSlug, projectSlug, branchName }
      : "skip",
  );

  const project = useQuery(
    api.projects.getProjectById,
    branch ? { projectId: branch.projectId } : "skip",
  );

  const { previewUrl, hasError, error, isCreating, loadingStage, isReady, retrySandbox } =
    useSandbox(branch?._id || null);

  const handleShare = async () => {
    if (!previewUrl) {
      toast.error("Preview URL not ready yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Preview URL copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy URL to clipboard");
    }
  };

  // Show not found state if branch query returned null
  if (branch === null) {
    return (
      <div className="h-dvh flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Branch not found</h1>
          <p className="text-muted-foreground">
            The branch "{branchName}" could not be found in this project.
          </p>
          <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  // Always render UI immediately - child components handle their own loading states
  return (
    <div className="h-dvh flex flex-col gap-2 p-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <BranchBreadcrumbs
          orgSlug={orgSlug || ""}
          projectSlug={projectSlug || ""}
          projectName={project?.name}
          branchName={branchName || ""}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleShare} disabled={!previewUrl}>
            Share
          </Button>
          {branch?._id && <PublishPopover branchId={branch._id} />}
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-2 flex-1 min-h-0">
        <ChatPanel branchId={branch?._id} isSandboxReady={isReady} />
        <PreviewPanel
          domain={previewUrl}
          hasError={hasError}
          error={error}
          isCreating={isCreating}
          isReady={isReady}
          loadingStage={loadingStage}
          onRetry={retrySandbox}
          branchId={branch?._id}
        />
      </div>
    </div>
  );
}
