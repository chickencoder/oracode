import { useEffect } from "react";
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

const formSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function ClaudeCodeSettingsPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // TODO: Save API key to backend
      console.log("Saving API key:", values);
      toast.success("API Key saved successfully");
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key");
    }
  };

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
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anthropic API Key</FormLabel>
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
                Save
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
