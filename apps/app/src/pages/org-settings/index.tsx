import { useEffect } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1, "Organization slug is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function OrgGeneralSettingsPage() {
  const { organization, isLoaded } = useOrganization();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Reset form when organization loads
  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        slug: organization.slug || "",
      });
    }
  }, [organization, form]);

  const onSubmit = async (values: FormValues) => {
    if (!organization) return;

    try {
      await organization.update({
        name: values.name,
        slug: values.slug,
      });

      toast.success("Organization settings updated successfully");
    } catch (error) {
      console.error("Failed to update organization:", error);
      toast.error("Failed to update organization settings");
    }
  };

  if (!isLoaded) {
    // Loading state
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!organization) {
    // Organization not found
    return null;
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Basic information about your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="my-organization"
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
    </div>
  );
}
