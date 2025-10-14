"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCcwIcon, Loader } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: Id<"branches">;
}

export function LogsDialog({ open, onOpenChange, branchId }: LogsDialogProps) {
  const [activeTab, setActiveTab] = useState<"worker" | "dev-server">("worker");
  const [workerLogs, setWorkerLogs] = useState<string>("");
  const [devServerLogs, setDevServerLogs] = useState<string>("");
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [devServerError, setDevServerError] = useState<string | null>(null);
  const [isLoadingWorker, setIsLoadingWorker] = useState(false);
  const [isLoadingDevServer, setIsLoadingDevServer] = useState(false);

  const getWorkerLogsAction = useAction(api.sandboxActions.getWorkerLogs);
  const getDevServerLogsAction = useAction(api.sandboxActions.getDevServerLogs);

  const fetchWorkerLogs = async () => {
    setIsLoadingWorker(true);
    setWorkerError(null);
    try {
      const result = await getWorkerLogsAction({ branchId });
      if (result.success) {
        setWorkerLogs(result.logs);
      } else {
        setWorkerError(result.error || "Failed to fetch worker logs");
      }
    } catch (error) {
      setWorkerError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingWorker(false);
    }
  };

  const fetchDevServerLogs = async () => {
    setIsLoadingDevServer(true);
    setDevServerError(null);
    try {
      const result = await getDevServerLogsAction({ branchId });
      if (result.success) {
        setDevServerLogs(result.logs);
      } else {
        setDevServerError(result.error || "Failed to fetch dev server logs");
      }
    } catch (error) {
      setDevServerError(
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setIsLoadingDevServer(false);
    }
  };

  // Fetch logs when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      fetchWorkerLogs();
      fetchDevServerLogs();
    }
    onOpenChange(newOpen);
  };

  const handleRefresh = () => {
    if (activeTab === "worker") {
      fetchWorkerLogs();
    } else {
      fetchDevServerLogs();
    }
  };

  const isLoading = activeTab === "worker" ? isLoadingWorker : isLoadingDevServer;

  // Initially show as loading until first fetch completes
  const showWorkerLoading = isLoadingWorker || (workerLogs === "" && !workerError);
  const showDevServerLoading = isLoadingDevServer || (devServerLogs === "" && !devServerError);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sandbox Logs</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="worker" onValueChange={(v) => setActiveTab(v as "worker" | "dev-server")} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="worker">Worker</TabsTrigger>
              <TabsTrigger value="dev-server">Dev Server</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcwIcon className="w-4 h-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
          <TabsContent
            value="worker"
            className="flex-1 flex flex-col min-h-0 mt-0"
          >
            {workerError ? (
              <Alert variant="destructive">
                <AlertDescription>{workerError}</AlertDescription>
              </Alert>
            ) : showWorkerLoading ? (
              <div className="flex-1 flex items-center justify-center bg-muted rounded-md">
                <Loader className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-muted rounded-md p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {workerLogs || "No logs available"}
                </pre>
              </div>
            )}
          </TabsContent>
          <TabsContent
            value="dev-server"
            className="flex-1 flex flex-col min-h-0 mt-0"
          >
            {devServerError ? (
              <Alert variant="destructive">
                <AlertDescription>{devServerError}</AlertDescription>
              </Alert>
            ) : showDevServerLoading ? (
              <div className="flex-1 flex items-center justify-center bg-muted rounded-md">
                <Loader className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-muted rounded-md p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {devServerLogs || "No logs available"}
                </pre>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
