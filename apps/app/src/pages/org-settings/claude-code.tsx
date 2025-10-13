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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

const formSchema = z.object({
  apiKey: z
    .string()
    .min(1, "API Key is required")
    .startsWith("sk-ant-", "Must be a valid Anthropic API key"),
});

type FormValues = z.infer<typeof formSchema>;

export function ClaudeCodeSettingsPage() {
  const settings = useQuery(api.settings.get);
  const setApiKey = useAction(api.settings.setAnthropicApiKey);
  const removeApiKey = useAction(
    api.settings.removeAnthropicApiKey,
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

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
      toast.error(
        error instanceof Error ? error.message : "Failed to save API key",
      );
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await removeApiKey({});
      toast.success("API Key removed successfully");
      setShowRemoveDialog(false);
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
            <CardTitle>Claude Code API Key</CardTitle>
            <CardDescription>
              Your Anthropic API key will be used by all members of this
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[68px] w-full bg-muted animate-pulse rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Claude Code API Key</CardTitle>
            <CardDescription>
              Your Anthropic API key will be used by all members of this
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasExistingKey ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="font-mono text-sm">••••••••••••••••</div>
                  <span className="text-sm text-muted-foreground">
                    API Key configured
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRemoveDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API key</FormLabel>
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
                  <Button
                    type="submit"
                    loading={form.formState.isSubmitting}
                    disabled={form.formState.isSubmitting}
                  >
                    Save
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the API key? This will affect all
              organization members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              loading={isRemoving}
              disabled={isRemoving}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
