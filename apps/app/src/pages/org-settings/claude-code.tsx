import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Trash2 } from "lucide-react";

const formSchema = z.object({
  apiKey: z.string().min(1, "API Key is required").startsWith("sk-ant-", "Must be a valid Anthropic API key"),
});

type FormValues = z.infer<typeof formSchema>;

export function ClaudeCodeSettingsPage() {
  const settings = useQuery(api.organizationSettings.get);
  const setApiKey = useAction(api.organizationSettings.setAnthropicApiKey);
  const removeApiKey = useAction(api.organizationSettings.removeAnthropicApiKey);
  const [isRemoving, setIsRemoving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const hasExistingKey = settings?.anthropicApiKey !== undefined;

  const onSubmit = async (values: FormValues) => {
    try {
      await setApiKey({ apiKey: values.apiKey });
      toast.success("API Key saved successfully");
      form.reset({ apiKey: "" });
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save API key");
    }
  };

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove the API key? This will affect all organization members.")) {
      return;
    }

    setIsRemoving(true);
    try {
      await removeApiKey({});
      toast.success("API Key removed successfully");
    } catch (error) {
      console.error("Failed to remove API key:", error);
      toast.error("Failed to remove API key");
    } finally {
      setIsRemoving(false);
    }
  };

  if (settings === undefined) {
    // Loading state
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-10 w-full bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>API Key</CardTitle>
              <CardDescription>
                Your Anthropic API key will be used by all members of this organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasExistingKey && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm">••••••••••••••••</div>
                    <span className="text-sm text-muted-foreground">API Key configured</span>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemove}
                    loading={isRemoving}
                    disabled={isRemoving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {hasExistingKey ? "Update API Key" : "Anthropic API Key"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="sk-ant-..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Get your API key from the{" "}
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium underline hover:no-underline"
                        >
                          Anthropic Console
                        </a>
                        .
                      </FormDescription>
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
                {hasExistingKey ? "Update" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
