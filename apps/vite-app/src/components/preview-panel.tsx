"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewNavigationButton,
} from "@/components/ai-elements/web-preview";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";

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
        <div className="max-w-md text-center space-y-4">
          <div className="text-destructive font-medium">Sandbox Error</div>
          <div className="text-sm text-muted-foreground">
            {error || "An error occurred while setting up the sandbox"}
          </div>
          <button
            onClick={onRetry}
            disabled={isCreating}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? "Retrying..." : "Retry Sandbox"}
          </button>
        </div>
      </div>
    );
  }

  // Show loading state with stages
  if (!domain || isCreating) {
    const loadingMessage = loadingStage
      ? {
          provisioning: "Provisioning sandbox...",
          cloning: "Cloning repository...",
          installing: "Installing dependencies...",
          starting: "Starting dev server...",
        }[loadingStage]
      : "Setting up sandbox...";

    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
