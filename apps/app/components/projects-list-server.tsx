import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { ProjectsListClient } from "./projects-list-client";
import { auth } from "@clerk/nextjs/server";

type ProjectsListServerProps = {
  searchQuery: string;
};

export async function ProjectsListServer({
  searchQuery,
}: ProjectsListServerProps) {
  const { getToken } = await auth();
  const preloadedProjects = await preloadQuery(
    api.projects.getUserProjects,
    {},
    { token: await getToken({ template: "convex" }) },
  );

  return (
    <ProjectsListClient
      preloadedProjects={preloadedProjects}
      initialSearchQuery={searchQuery}
    />
  );
}
