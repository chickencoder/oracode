import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { ProjectHeaderClient } from "@/components/project-header-client";
import { auth } from "@clerk/nextjs/server";

type LayoutProps = {
  params: Promise<{ projectId: Id<"projects"> }>;
  children: React.ReactNode;
};

export default async function ProjectLayout({ params, children }: LayoutProps) {
  const { projectId } = await params;
  const { getToken } = await auth();
  const preloadedProject = await preloadQuery(
    api.projects.getProjectById,
    {
      projectId,
    },
    {
      token: await getToken({ template: "convex" }),
    },
  );

  return (
    <>
      <ProjectHeaderClient preloadedProject={preloadedProject} />
      {children}
    </>
  );
}
