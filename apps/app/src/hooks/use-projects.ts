import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/clerk-react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";

export type Project = {
  _id: Id<"projects">;
  githubRepoId: number;
  name: string;
  slug?: string;
  description: string;
  settings: {
    installCommand: string;
    devCommand: string;
    port: number;
  };
  createdAt: number;
};

export function useProjects() {
  const { organization } = useOrganization();
  // Skip query if no active organization to prevent auth errors
  const projects = useQuery(
    api.projects.getProjects,
    organization ? {} : "skip"
  );

  return {
    projects: projects ?? [],
    isLoading: projects === undefined,
  };
}
