import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
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

  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { projects, isLoading } = useProjects();

  // If org not found after loading, redirect to onboarding
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate("/");
    }
  }, [isLoaded, organization, navigate]);

  return (
    <main className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <Input placeholder="Search projects" className="max-w-72" />
        <NewProjectDialog />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects.length > 0 ? (
        <div className="space-y-3">
          {projects.map((project) => (
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
            Create a new project to get started
          </span>
        </div>
      )}
    </main>
  );
}
