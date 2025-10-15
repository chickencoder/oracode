import { useEffect } from "react";
import { useParams, useNavigate, Outlet } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useOrganization } from "@clerk/clerk-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { useProjects } from "@/hooks/use-projects";
import { useOrgSelection } from "@/hooks/use-org-selection";
import type { Tab } from "@/types/dashboard";

const tabs: Tab[] = [
  {
    label: "Branches",
    href: "",
  },
  {
    label: "Settings",
    href: "/settings",
  },
];

export function ProjectLayout() {
  const navigate = useNavigate();
  const { orgSlug, projectId } = useParams<{
    orgSlug: string;
    projectId: string;
  }>();
  const { organization } = useOrganization();
  const { orgs, isOrgsLoaded, handleOrgSelect } = useOrgSelection();

  const project = useQuery(
    api.projects.getProjectById,
    projectId && organization?.id ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const { projects, isLoading: isProjectsLoading } = useProjects();

  const handleProjectSelect = (newProjectId: Id<"projects">) => {
    if (newProjectId) {
      navigate(`/${orgSlug}/project/${newProjectId}`);
    }
  };

  // Enhanced org select handler - navigate to org page first to avoid race condition
  const handleOrgSelectFromProject = async (newOrgSlug: string) => {
    // Navigate to org page immediately to avoid querying old project with new org
    navigate(`/${newOrgSlug}`);
    // Then update the active org
    await handleOrgSelect(newOrgSlug);
  };

  // If project not found after loading, redirect to org page
  useEffect(() => {
    if (project === null) {
      navigate(`/${orgSlug}`);
    }
  }, [project, orgSlug, navigate]);

  return (
    <>
      <DashboardHeader
        tabs={tabs}
        basePath={`/${orgSlug}/project/${projectId}`}
        orgs={orgs}
        currentOrgSlug={orgSlug}
        onOrgSelect={handleOrgSelectFromProject}
        isOrgsLoading={!isOrgsLoaded}
        projects={projects}
        currentProjectId={projectId as Id<"projects">}
        onProjectSelect={handleProjectSelect}
        isProjectsLoading={isProjectsLoading}
      />
      <Outlet />
    </>
  );
}
