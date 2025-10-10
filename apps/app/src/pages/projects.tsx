import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useOrgNavigation } from "../hooks/use-org-navigation";
import { useProjects, type Project } from "../hooks/use-projects";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import {
  Card,
  CardTitle,
  CardDescription,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EllipsisVertical,
  Folder,
  Rocket,
  SearchIcon,
  Settings,
  Trash2,
} from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useQueryState("q", { defaultValue: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { projects, isLoading } = useProjects();

  const handleProjectClick = (project: Project) => {
    navigate(`/${orgSlug}/project/${project._id}`);
  };

  const handleLaunchSession = (project: Project) => {
    navigate(`/${orgSlug}/project/${project._id}`);
  };

  const handleEditClick = (project: Project) => {
    navigate(`/${orgSlug}/project/${project._id}/settings`);
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
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
                className="rounded-md relative shadow-xs cursor-pointer hover:bg-accent/50 transition-colors"
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
                <CardContent className="absolute top-0 right-0 p-3 flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <EllipsisVertical className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchSession(project);
                        }}
                      >
                        <Rocket className="size-4" />
                        Launch session
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(project);
                        }}
                      >
                        <Settings className="size-4" />
                        Edit settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(project);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 text-destructive" />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>

          <DeleteProjectDialog
            project={projectToDelete}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          />
        </>
      ) : (
        <Empty className="border border-dashed min-h-[500px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Folder />
            </EmptyMedia>
            <EmptyTitle>No projects found</EmptyTitle>
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
