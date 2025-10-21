import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useOrgNavigation } from "../hooks/use-org-navigation";
import { useProjects, type Project } from "../hooks/use-projects";
import { NewProjectDialog } from "@/components/new-project-dialog";
import {
  Card,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Folder, SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useQueryState("q", { defaultValue: "" });

  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { projects, isLoading } = useProjects();

  const handleProjectClick = (project: Project) => {
    // Use slug if available, otherwise fall back to _id
    const projectIdentifier = project.slug || project._id;
    navigate(`/${orgSlug}/${projectIdentifier}`);
  };

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!search) return projects;

    const query = search.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query),
    );
  }, [projects, search]);

  // If org not found after loading, redirect to onboarding
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate("/");
    }
  }, [isLoaded, organization, navigate]);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <InputGroup className="max-w-72 bg-card">
          <InputGroupInput
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>

        <NewProjectDialog />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredProjects.length > 0 ? (
        <>
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <Card
                key={project._id}
                className="rounded-md shadow-xs cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleProjectClick(project)}
              >
                <CardHeader>
                  <CardTitle className="font-medium tracking-tight text-lg">
                    {project.name}
                  </CardTitle>
                  <CardDescription>
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Empty className="border border-dashed min-h-[500px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Folder />
            </EmptyMedia>
            <EmptyTitle>No Projects Yet</EmptyTitle>
            <EmptyDescription>
              {search
                ? `No projects found matching "${search}"`
                : "Create a new project to get started"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </main>
  );
}
