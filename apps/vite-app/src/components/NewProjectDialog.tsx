"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { RepositoryDropdown } from "./RepositoryDropdown";
import { useRepositories } from "@/hooks/useRepositories";

const formSchema = z.object({
  githubRepoId: z.number({
    error: "Please select a repository",
  }),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  installCommand: z.string().min(1, "Install command is required"),
  devCommand: z.string().min(1, "Development command is required"),
  port: z.number().min(1).max(65535, "Port must be between 1 and 65535"),
});

type FormValues = z.infer<typeof formSchema>;

interface NewProjectDialogProps {
  children?: React.ReactNode;
}

export function NewProjectDialog({ children }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const createProject = useMutation(api.projects.createProject);
  const { repos } = useRepositories();

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

  // Set default repository to first item when repos load
  useEffect(() => {
    if (repos && repos.length > 0 && !form.getValues("githubRepoId")) {
      const firstRepo = repos[0];
      form.setValue("githubRepoId", firstRepo.id);
      form.setValue("name", firstRepo.name);
      form.setValue("description", firstRepo.description || "");
    }
  }, [repos, form]);

  // Watch for repository changes and update name/description
  const selectedRepoId = form.watch("githubRepoId");
  useEffect(() => {
    if (selectedRepoId && repos) {
      const selectedRepo = repos.find((repo) => repo.id === selectedRepoId);
      if (selectedRepo) {
        form.setValue("name", selectedRepo.name);
        form.setValue("description", selectedRepo.description || "");
      }
    }
  }, [selectedRepoId, repos, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await createProject({
        githubRepoId: values.githubRepoId,
        name: values.name,
        description: values.description,
        settings: {
          installCommand: values.installCommand,
          devCommand: values.devCommand,
          port: values.port,
        },
      });

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
      // You could add toast notification here
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>New project</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Link a GitHub repository and configure your project settings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="githubRepoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository</FormLabel>
                  <FormControl>
                    <RepositoryDropdown
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
