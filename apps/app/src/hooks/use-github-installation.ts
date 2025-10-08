import { useSearchParams } from "react-router";

export type GitHubInstallationCallback = {
  installationStatus: "success" | "error" | null;
  githubOrg: string | null;
};

/**
 * Hook to parse GitHub App installation callback parameters from URL
 * Returns the installation status and GitHub org login if present
 */
export function useGitHubInstallation(): GitHubInstallationCallback {
  const [searchParams] = useSearchParams();

  const installationStatus = searchParams.get("installation");
  const githubOrg = searchParams.get("githubOrg");

  return {
    installationStatus:
      installationStatus === "success"
        ? "success"
        : installationStatus === "error"
          ? "error"
          : null,
    githubOrg,
  };
}
