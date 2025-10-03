import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { ProjectsListClient } from "./projects-list-client";
import { getToken } from "@/lib/auth-server";

type ProjectsListServerProps = {
  searchQuery: string;
  orgId: string;
};

export async function ProjectsListServer({
  searchQuery,
  orgId,
}: ProjectsListServerProps) {
  const preloadedProjects = await preloadQuery(
    api.projects.getUserProjects,
    { orgId },
    { token: await getToken() },
  );

  return (
    <ProjectsListClient
      preloadedProjects={preloadedProjects}
      initialSearchQuery={searchQuery}
    />
  );
}
