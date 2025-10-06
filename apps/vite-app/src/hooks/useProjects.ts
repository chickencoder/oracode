import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";

export type Project = {
  _id: Id<"projects">;
  githubRepoId: number;
  name: string;
  description: string;
  settings: {
    installCommand: string;
    devCommand: string;
    port: number;
  };
  createdAt: number;
};

export function useProjects() {
  const projects = useQuery(api.projects.getProjects);

  return {
    projects: projects ?? [],
    isLoading: projects === undefined,
  };
}
