import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import type { Project } from "@/hooks/use-projects";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  installCommand: z.string().min(1, "Install command is required"),
  devCommand: z.string().min(1, "Development command is required"),
  port: z.number().min(1).max(65535, "Port must be between 1 and 65535"),
});

type FormValues = z.infer<typeof formSchema>;

export function ProjectSettingsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateProject = useMutation(api.projects.updateProject);
  const project = useQuery(
    api.projects.getProjectById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      installCommand: "npm install",
      devCommand: "npm run dev",
      port: 3000,
    },
  });

  // Reset form when project loads
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description,
        installCommand: project.settings.installCommand,
        devCommand: project.settings.devCommand,
        port: project.settings.port,
      });
    }
  }, [project, form]);

  const onSubmit = async (values: FormValues) => {
    if (!projectId) return;

    try {
      await updateProject({
        projectId: projectId as Id<"projects">,
        name: values.name,
        description: values.description,
        settings: {
          installCommand: values.installCommand,
          devCommand: values.devCommand,
          port: values.port,
        },
      });

      // Show success feedback or redirect
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  };

  const handleDeleteSuccess = () => {
    // Navigate back to org page after successful delete
    navigate(`/${orgSlug}`);
  };

  if (project === undefined) {
    // Loading state
    return (
      <main className="p-4 max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </main>
    );
  }

  if (project === null) {
    // Project not found
    return null;
  }

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your project settings and configuration.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Awesome Project" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="A brief description of your project"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="installCommand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Install Command</FormLabel>
                  <FormControl>
                    <Input placeholder="npm install" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="devCommand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dev Command</FormLabel>
                  <FormControl>
                    <Input placeholder="npm run dev" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Port</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="3000"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/${orgSlug}/project/${projectId}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Form>

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete this project and all associated sessions.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Project
        </Button>
      </div>

      <DeleteProjectDialog
        project={project as Project}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />
    </main>
  );
}
