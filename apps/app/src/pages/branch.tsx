import { useParams, useNavigate } from "react-router";
import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { useSandbox } from "@/hooks/use-sandbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";

export function BranchPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [showWorkerLogs, setShowWorkerLogs] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<string>("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const branch = useQuery(
    api.branches.getBranchById,
    branchId && organization?.id ? { branchId: branchId as Id<"branches"> } : "skip",
  );

  const getWorkerLogs = useAction(api.sandboxActions.getWorkerLogs);

  const { previewUrl, hasError, error, isCreating, loadingStage, isReady, retrySandbox } =
    useSandbox(branchId ? (branchId as Id<"branches">) : null);

  useEffect(() => {
    if (branch === null) {
      // Branch not found or not authorized, redirect back
      navigate(-1);
    }
  }, [branch, navigate]);

  const handleFetchWorkerLogs = async () => {
    if (!branchId) return;

    setIsLoadingLogs(true);
    try {
      const result = await getWorkerLogs({ branchId: branchId as Id<"branches"> });
      if (result.success) {
        setWorkerLogs(result.logs);
        setShowWorkerLogs(true);
      } else {
        setWorkerLogs(`Error: ${result.error}`);
        setShowWorkerLogs(true);
      }
    } catch (err) {
      setWorkerLogs(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setShowWorkerLogs(true);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Always render UI immediately - child components handle their own loading states
  return (
    <div className="h-dvh flex flex-col gap-2 p-2">
      <div className="flex gap-2 flex-1 min-h-0">
        <ChatPanel
          branchId={branchId as Id<"branches">}
          isSandboxReady={isReady}
        />
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchWorkerLogs}
              disabled={isLoadingLogs}
            >
              <Terminal className="w-4 h-4 mr-2" />
              {isLoadingLogs ? "Loading..." : "Worker Logs"}
            </Button>
            {showWorkerLogs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorkerLogs(false)}
              >
                Hide Logs
              </Button>
            )}
          </div>

          {showWorkerLogs && (
            <div className="bg-black text-green-400 rounded-lg p-4 font-mono text-xs max-h-48 overflow-hidden flex flex-col">
              <div className="text-gray-400 mb-2">Worker Process Logs:</div>
              <ScrollArea className="flex-1">
                <pre className="whitespace-pre-wrap">{workerLogs}</pre>
              </ScrollArea>
            </div>
          )}

          <PreviewPanel
            domain={previewUrl}
            hasError={hasError}
            error={error}
            isCreating={isCreating}
            loadingStage={loadingStage}
            onRetry={retrySandbox}
          />
        </div>
      </div>
    </div>
  );
}
