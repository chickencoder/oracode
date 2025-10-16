import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useOrganization } from "@clerk/clerk-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import type { Project } from "@/hooks/use-projects";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function GeneralSettingsPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { organization } = useOrganization();

  const updateProject = useMutation(api.projects.updateProject);
  const project = useQuery(
    api.projects.getProjectByOrgAndSlug,
    projectSlug && organization?.id
      ? { orgId: organization.id, slug: projectSlug }
      : "skip",
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Reset form when project loads
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description,
      });
    }
  }, [project, form]);

  const onSubmit = async (values: FormValues) => {
    if (!project) return;

    try {
      await updateProject({
        projectId: project._id,
        name: values.name,
        description: values.description,
        settings: project.settings, // Keep existing settings
      });

      toast.success("Project settings updated successfully");
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
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (project === null) {
    // Project not found
    return null;
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                Basic information about your project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
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
              </div>

              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={form.formState.isSubmitting}
              >
                Save
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      <Card className="flex flex-row items-center justify-between p-6">
        <div>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this project and all associated branches.
          </CardDescription>
        </div>
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          Delete project
        </Button>
      </Card>

      <DeleteProjectDialog
        project={project as Project}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
