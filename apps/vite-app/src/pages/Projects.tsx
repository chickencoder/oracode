import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useOrgNavigation } from "../hooks/useOrgNavigation";
import { useProjects } from "../hooks/useProjects";
import { Input } from "@/components/ui/input";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import {
  Card,
  CardTitle,
  CardDescription,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EllipsisVertical } from "lucide-react";

export function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useQueryState("q", { defaultValue: "" });

  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { projects, isLoading } = useProjects();

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
        <Input
          placeholder="Search projects"
          className="max-w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <NewProjectDialog />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <Card key={project._id} className="rounded-md relative shadow-xs">
              <CardHeader>
                <CardTitle className="font-medium tracking-tight text-lg">
                  {project.name}
                </CardTitle>
                <CardDescription>
                  {project.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="absolute top-0 right-0 p-3 flex gap-2">
                <Button size="icon" variant="ghost">
                  <EllipsisVertical size="size-5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[500px] border border-dashed rounded-md">
          <span className="text-muted-foreground text-sm">
            {search
              ? `No projects found matching "${search}"`
              : "Create a new project to get started"}
          </span>
        </div>
      )}
    </main>
  );
}
