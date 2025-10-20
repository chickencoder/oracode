import { useEffect } from "react";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useOrganization } from "@clerk/clerk-react";
import { api } from "@repo/convex/_generated/api";
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

const formSchema = z.object({
  installCommand: z.string().min(1, "Install command is required"),
  devCommand: z.string().min(1, "Development command is required"),
  port: z.number().min(1).max(65535, "Port must be between 1 and 65535"),
  projectRoot: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function DevelopmentSettingsPage() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
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
      installCommand: "npm install",
      devCommand: "npm run dev",
      port: 3000,
      projectRoot: "",
    },
  });

  // Reset form when project loads
  useEffect(() => {
    if (project) {
      form.reset({
        installCommand: project.settings.installCommand,
        devCommand: project.settings.devCommand,
        port: project.settings.port,
        projectRoot: project.settings.projectRoot || "",
      });
    }
  }, [project, form]);

  const onSubmit = async (values: FormValues) => {
    if (!project) return;

    try {
      await updateProject({
        projectId: project._id,
        name: project.name,
        description: project.description,
        settings: {
          installCommand: values.installCommand,
          devCommand: values.devCommand,
          port: values.port,
          projectRoot: values.projectRoot || undefined,
        },
      });

      toast.success("Development settings updated successfully");
    } catch (error) {
      console.error("Failed to update project:", error);
    }
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
              <CardTitle>Sandbox Settings</CardTitle>
              <CardDescription>
                Configure how your project is built and run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
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

                <div className="grid grid-cols-2 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="projectRoot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Root</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. apps/app" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          For monorepos - where install/dev commands are run and the sandbox working directory is set. Leave empty for repository root.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>
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
    </div>
  );
}
