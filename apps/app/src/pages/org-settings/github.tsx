import { useState, useEffect } from "react";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@repo/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Trash2 } from "lucide-react";

export function GitHubSettingsPage() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const [searchParams] = useSearchParams();

  const installation = useQuery(
    api.github.getInstallation,
    organization?.id ? {} : "skip"
  );

  const createInstallationState = useMutation(
    api.github.createInstallationState
  );

  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Handle GitHub App installation callback
  useEffect(() => {
    const reconnectStatus = searchParams.get("reconnect");

    if (reconnectStatus === "success") {
      toast.success("GitHub reconnected successfully");
      // Remove query params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const handleInstallGitHubApp = async () => {
    setIsInstalling(true);
    setError(null);

    if (!user?.id || !organization?.id) {
      setError("User or organization not authenticated");
      setIsInstalling(false);
      return;
    }

    try {
      const { stateToken } = await createInstallationState({
        userId: user.id,
        orgId: organization.id,
      });

      const githubAppSlug = import.meta.env.VITE_GITHUB_APP_SLUG;
      if (!githubAppSlug) {
        throw new Error("GitHub App slug not configured");
      }

      const installUrl = `https://github.com/apps/${githubAppSlug}/installations/new?state=${stateToken}`;
      window.location.href = installUrl;
    } catch (err) {
      console.error("Failed to start GitHub App installation:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to start installation";
      setError(message);
      toast.error(message);
      setIsInstalling(false);
    }
  };

  const handleRemove = async () => {
    // Note: GitHub App uninstallation must be done through GitHub's UI
    // Users can uninstall at: https://github.com/settings/installations
    // or https://github.com/organizations/{org}/settings/installations
    toast.info(
      "To remove the GitHub connection, please uninstall the app from your GitHub settings",
      { duration: 5000 }
    );
    setShowRemoveDialog(false);
  };

  const handleRetry = () => {
    setError(null);
  };

  // Loading state
  if (installation === undefined) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>GitHub Connection</CardTitle>
            <CardDescription>
              Connect your GitHub organization to enable repository access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[120px] w-full bg-muted animate-pulse rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasInstallation = installation !== null;

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>GitHub Connection</CardTitle>
            <CardDescription>
              Connect your GitHub organization to enable repository access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p>{error}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleRetry}
                    className="h-auto p-0 mt-1 text-destructive"
                  >
                    Try again
                  </Button>
                </div>
              </div>
            )}

            {hasInstallation ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://github.com/${installation.githubOrgLogin}.png?s=40`}
                    alt={installation.githubOrgLogin}
                    className="size-8 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div>
                    <div className="font-medium">{installation.githubOrgLogin}</div>
                    <div className="text-sm text-muted-foreground">
                      Connected to GitHub
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleInstallGitHubApp}
                    loading={isInstalling}
                  >
                    Reconnect
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You will be redirected to GitHub to grant access to your
                  organization or personal account.
                </p>
                <Button
                  onClick={handleInstallGitHubApp}
                  loading={isInstalling}
                  size="lg"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Connect to GitHub
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove GitHub Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the GitHub connection? This will affect all
              organization members and projects.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
