import { useState } from "react";
import { UserButton, useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function NewAccountPage() {
  const { user } = useUser();

  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInstallationState = useMutation(
    api.github.createInstallationState,
  );

  const handleInstallGitHubApp = async () => {
    setIsInstalling(true);
    setError(null);

    if (!user?.id) {
      setError("User not authenticated");
      setIsInstalling(false);
      return;
    }

    try {
      const { stateToken } = await createInstallationState({
        userId: user.id,
        orgId: undefined,
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

  const handleRetry = () => {
    setError(null);
  };

  // Main UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-lg tracking-tight font-medium">
            Connect to GitHub
          </CardTitle>
          <CardDescription>
            You will be redirected to GitHub to grant access to your organization or personal account
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
          <Button
            onClick={handleInstallGitHubApp}
            loading={isInstalling}
            disabled={isInstalling}
            className="w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}
