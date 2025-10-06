import { ProjectsToolbar } from "@/components/projects-toolbar";
import { ProjectsListServer } from "@/components/projects-list-server";
import { DashboardNavigation } from "@/components/dashboard-navigation";

type ProjectsPageProps = {
  searchParams: Promise<{ q?: string }>;
  params: Promise<{ orgId: string }>;
};

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { q: searchQuery = "" } = await searchParams;

  return (
    <div className="space-y-8">
      <DashboardNavigation />
      <div className="space-y-4">
        <ProjectsToolbar defaultSearchQuery={searchQuery} />
        <ProjectsListServer searchQuery={searchQuery} />
      </div>
    </div>
  );
}
