"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewNavigationButton,
} from "@/components/ai-elements/web-preview";
import { ExternalLinkIcon, Loader, RefreshCcwIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
interface PreviewPanelProps {
  domain: string;
  hasError: boolean;
  error?: string;
  isCreating: boolean;
  loadingStage?: "provisioning" | "cloning" | "installing" | "starting";
  onRetry: () => void;
}

export function PreviewPanel({
  domain,
  hasError,
  error,
  isCreating,
  loadingStage,
  onRetry,
}: PreviewPanelProps) {
  const [url, setUrl] = useState(domain);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update URL when domain prop changes
  useEffect(() => {
    if (domain) {
      setUrl(domain);
    }
  }, [domain]);

  // Show error state
  if (hasError) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Alert className="max-w-sm mx-auto flex flex-col gap-3">
          <AlertTitle className="text-lg">Sandbox Error</AlertTitle>
          <AlertDescription>
            {error || "An error occurred while setting up the sandbox"}
          </AlertDescription>
          <Button
            onClick={onRetry}
            variant="destructive"
            size="sm"
            disabled={isCreating}
          >
            {isCreating ? "Retrying..." : "Try again"}
          </Button>
        </Alert>
      </div>
    );
  }

  // Show loading state when domain is not available (either creating or waiting)
  if (!domain && !hasError) {
    const loadingMessage = loadingStage
      ? {
          provisioning: "Provisioning sandbox...",
          cloning: "Cloning repository...",
          installing: "Installing dependencies...",
          starting: "Starting dev server...",
        }[loadingStage]
      : "Initializing preview...";

    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader className="size-4 animate-spin" />
          <div className="text-muted-foreground">{loadingMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <WebPreview
        defaultUrl={url}
        className="h-full rounded-lg overflow-hidden"
      >
        <WebPreviewNavigation>
          <WebPreviewNavigationButton
            tooltip="Refresh"
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
          >
            <RefreshCcwIcon className="w-4 h-4" />
          </WebPreviewNavigationButton>
          <WebPreviewUrl src={url} onChange={(e) => setUrl(e.target.value)} />
          <WebPreviewNavigationButton
            tooltip="Open in new tab"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        <WebPreviewBody src={url} className="bg-white flex-1" ref={iframeRef} />
      </WebPreview>
    </div>
  );
}
