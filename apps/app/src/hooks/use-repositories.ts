import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useOrganization } from "@clerk/clerk-react";
import { api } from "@repo/convex/_generated/api";

export type Repository = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
};

export function useRepositories(enabled: boolean = true) {
  const { organization } = useOrganization();
  const listRepositories = useAction(api.github.listRepositories);
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if disabled or no active organization
    if (!enabled || !organization) {
      return;
    }

    setLoading(true);
    setError(null);

    listRepositories({})
      .then((repos) => {
        setRepos(repos);
      })
      .catch((error) => {
        console.error("Failed to fetch repositories:", error);
        setError("Failed to load repositories. Please try again.");
        setRepos([]);
      })
      .finally(() => setLoading(false));
  }, [enabled, organization, listRepositories]);

  return { repos, loading, error };
}
