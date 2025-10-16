"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewNavigationButton,
} from "@/components/ai-elements/web-preview";
import {
  ArrowLeft,
  ArrowRight,
  Loader,
  RefreshCcwIcon,
  MoreVertical,
  FileText,
  RotateCw,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogsDialog } from "./logs-dialog";
import { toast } from "sonner";
interface PreviewPanelProps {
  domain: string;
  hasError: boolean;
  error?: string;
  isCreating: boolean;
  isReady: boolean;
  loadingStage?: "provisioning" | "cloning" | "installing" | "starting";
  onRetry: () => void;
  branchId: Id<"branches"> | undefined;
}

export function PreviewPanel({
  domain,
  hasError,
  error,
  isCreating,
  isReady,
  loadingStage,
  onRetry,
  branchId,
}: PreviewPanelProps) {
  const [isIframeLoading, setIsIframeLoading] = useState(!!domain);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const restartSandboxAction = useAction(api.sandboxActions.restartSandbox);

  const handleRetry = () => {
    setIsRetrying(true);
    onRetry();
  };

  const handleRestartSandbox = async () => {
    setIsRestarting(true);
    try {
      await restartSandboxAction({ branchId });
      toast.success("Sandbox restarted successfully");
      // Refresh the iframe after restart
      handleRefresh();
    } catch (error) {
      console.error("Failed to restart sandbox:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to restart sandbox"
      );
    } finally {
      setIsRestarting(false);
    }
  };

  // Update loading state when domain changes
  useEffect(() => {
    if (domain) {
      setIsIframeLoading(true);
    }
  }, [domain]);

  // Handle iframe load event
  const handleIframeLoad = () => {
    setIsIframeLoading(false);
  };

  const showSandboxLoading = !isReady && !hasError;
  const loadingMessage = loadingStage
    ? {
        provisioning: "Provisioning sandbox...",
        cloning: "Cloning repository...",
        installing: "Installing dependencies...",
        starting: "Starting dev server...",
      }[loadingStage]
    : "Initializing preview...";

  const handleRefresh = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      const currentSrc = iframe.src;
      iframe.src = "";
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 0);
    }
  };

  return (
    <div className="flex-1 min-h-0 relative">
      <WebPreview
        defaultUrl={domain}
        className="h-full rounded-lg overflow-hidden"
      >
        <WebPreviewNavigation>
          <WebPreviewNavigationButton tooltip="Back">
            <ArrowLeft className="w-4 h-4" />
          </WebPreviewNavigationButton>
          <WebPreviewNavigationButton tooltip="Forward">
            <ArrowRight className="w-4 h-4" />
          </WebPreviewNavigationButton>
          <WebPreviewNavigationButton tooltip="Refresh" onClick={handleRefresh}>
            <RefreshCcwIcon className="w-4 h-4" />
          </WebPreviewNavigationButton>
          <WebPreviewUrl value={domain} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <WebPreviewNavigationButton tooltip="More options">
                <MoreVertical className="w-4 h-4" />
              </WebPreviewNavigationButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsLogsDialogOpen(true)}>
                <FileText className="w-4 h-4 mr-2" />
                View logs
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleRestartSandbox}
                disabled={isRestarting}
              >
                <RotateCw className="w-4 h-4 mr-2" />
                {isRestarting ? "Restarting..." : "Restart sandbox"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </WebPreviewNavigation>
        <div className="relative flex-1 flex flex-col">
          {showSandboxLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center flex flex-col items-center space-y-3">
                <Loader className="size-4 animate-spin" />
                <div className="text-muted-foreground">{loadingMessage}</div>
              </div>
            </div>
          )}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <Alert className="max-w-sm mx-auto flex items-center text-center flex-col bg-transparent p-4 py-8 border-dashed">
                <AlertTitle className="text-lg mb-2">Sandbox Error</AlertTitle>
                <AlertDescription className="mb-4">
                  {error || "An error occurred while setting up the sandbox"}
                </AlertDescription>
                <Button
                  onClick={handleRetry}
                  loading={isRetrying}
                  size="sm"
                  disabled={isCreating}
                >
                  Try again
                </Button>
              </Alert>
            </div>
          )}
          <WebPreviewBody
            src={domain}
            className="bg-white flex-1"
            ref={iframeRef}
            onLoad={handleIframeLoad}
          />
        </div>
      </WebPreview>
      <LogsDialog
        open={isLogsDialogOpen}
        onOpenChange={setIsLogsDialogOpen}
        branchId={branchId}
      />
    </div>
  );
}
