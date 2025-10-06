import { useEffect } from "react";
import { useOrganizationList, useUser } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useGitHubInstallation } from "../hooks/useGitHubInstallation";
import { normalizeOrgSlug } from "../lib/constants";

export function InstallGitHubAppPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we're linking to an existing org
  const existingOrgId = searchParams.get("orgId");

  const {
    isLoaded: orgLoaded,
    userMemberships,
    createOrganization,
  } = useOrganizationList({ userMemberships: true });
  const { isLoaded: userLoaded, user } = useUser();

  const createInstallationState = useMutation(
    api.github.createInstallationState,
  );
  const linkOrganizationToInstallation = useMutation(
    api.github.linkOrganizationToInstallation,
  );

  const { status, isLinking, isCreating, setStatus } =
    useGitHubInstallation(existingOrgId);

  useEffect(() => {
    // Handle org creation separately since it requires createOrganization from the component
    const installationStatus = searchParams.get("installation");
    const githubOrg = searchParams.get("githubOrg");

    if (
      installationStatus === "success" &&
      githubOrg &&
      status === "creating" &&
      orgLoaded &&
      userMemberships
    ) {
      const expectedSlug = normalizeOrgSlug(githubOrg);

      createOrganization?.({
        name: githubOrg,
        slug: expectedSlug,
      })
        .then(async (org) => {
          await linkOrganizationToInstallation({
            githubOrgLogin: githubOrg,
          });
          navigate(`/${org.slug}`, { replace: true });
        })
        .catch((error) => {
          console.error("Failed to create organization:", error);
          setStatus("idle");
        });
    }
  }, [
    searchParams,
    status,
    orgLoaded,
    userMemberships,
    createOrganization,
    linkOrganizationToInstallation,
    navigate,
    setStatus,
  ]);

  const handleInstallGitHubApp = async () => {
    if (!user?.id) return;

    try {
      const { stateToken } = await createInstallationState({
        userId: user.id,
        orgId: existingOrgId || undefined,
      });

      const githubAppSlug = import.meta.env.VITE_GITHUB_APP_SLUG;
      if (!githubAppSlug) {
        throw new Error("GitHub App slug not configured");
      }

      const installUrl = `https://github.com/apps/${githubAppSlug}/installations/new?state=${stateToken}`;
      window.location.href = installUrl;
    } catch (error) {
      console.error("Failed to start GitHub App installation:", error);
    }
  };

  if (!orgLoaded || !userLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLinking) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-lg font-medium">Linking GitHub installation...</p>
          <p className="text-sm text-gray-600">
            Connecting your GitHub repositories
          </p>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-lg font-medium">Setting up your organization...</p>
          <p className="text-sm text-gray-600">
            Creating your organization and linking GitHub
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {existingOrgId ? "Connect GitHub" : "Install GitHub App"}
          </h1>
          <p className="mt-2 text-gray-600">
            {existingOrgId
              ? "Connect your GitHub repositories to this organization"
              : "Install our GitHub App to connect your organization's repositories"}
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">What happens next?</h3>
            <ul className="mt-2 space-y-1 text-sm text-blue-800">
              <li>• You'll be redirected to GitHub</li>
              <li>• Select which GitHub organization to connect</li>
              <li>• Grant repository access permissions</li>
              {!existingOrgId && (
                <li>• We'll create your organization with the GitHub name</li>
              )}
            </ul>
          </div>

          <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> If you've already installed the app, you
              may need to uninstall it first from GitHub settings and try again.
            </p>
          </div>

          <button
            onClick={handleInstallGitHubApp}
            className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Install GitHub App
          </button>
        </div>
      </div>
    </div>
  );
}
