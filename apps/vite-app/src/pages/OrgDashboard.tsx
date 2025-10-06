import { useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/clerk-react";
import { useParams, useNavigate } from "react-router";
import { useOrgNavigation } from "../hooks/useOrgNavigation";
import { useRepositories } from "../hooks/useRepositories";

export function OrgDashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();

  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { repos, loading, error } = useRepositories(organization?.id);

  // If org not found after loading, redirect to onboarding
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate("/");
    }
  }, [isLoaded, organization, navigate]);

  if (!isLoaded || !organization) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600">Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Oracode</h1>
            <OrganizationSwitcher
              afterSelectOrganizationUrl={(org) => `/${org.slug}`}
            />
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">{organization.name}</h2>
          <p className="mt-2 text-gray-600">
            Manage your repositories and development workflow
          </p>
        </div>

        <div className="mt-8">
          <h3 className="text-2xl font-semibold mb-4">Your Repositories</h3>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              <p>Loading repositories...</p>
            </div>
          ) : repos === null ? (
            <p className="text-gray-500">Loading...</p>
          ) : repos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-gray-500 mb-4">No repositories found</p>
              <p className="text-sm text-gray-400">
                Make sure you've granted access to repositories in your GitHub
                App settings
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded-lg p-4 hover:border-gray-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-lg">{repo.name}</h4>
                    {repo.private && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {repo.description || "No description"}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">{repo.fullName}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
