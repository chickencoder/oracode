import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  orgSlug: string;
}

// Git branch name validation schema
const branchFormSchema = z.object({
  branchName: z
    .string()
    .min(1, "Branch name cannot be empty")
    .max(255, "Branch name is too long")
    .regex(
      /^(?!\/|\.|-)(?!.*\.\.)(?!.*\.lock$)[a-zA-Z0-9\/_-]+$/,
      "Invalid branch name. Use only letters, numbers, hyphens, underscores, and forward slashes.",
    ),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

export function CreateBranchDialog({
  open,
  onOpenChange,
  projectId,
}: CreateBranchDialogProps) {
  const createBranch = useMutation(api.branches.createBranch);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      branchName: "",
    },
  });

  const onSubmit = async (values: BranchFormValues) => {
    try {
      await createBranch({
        projectId,
        branchName: values.branchName.trim(),
      });
      toast.success(`Branch "${values.branchName}" created`);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create branch:", error);
      toast.error("Failed to create branch");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Branch</DialogTitle>
          <DialogDescription>
            A branch is an isolated workspace for making code changes
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="branchName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="my-test-branch"
                      {...field}
                      autoFocus
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
                type="button"
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create Branch
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
