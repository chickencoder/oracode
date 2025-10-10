import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreateBranchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  orgSlug: string;
}

export function CreateBranchModal({
  open,
  onOpenChange,
  projectId,
}: CreateBranchModalProps) {
  const [branchName, setBranchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createBranch = useMutation(api.branches.createBranch);

  const validateBranchName = (name: string): boolean => {
    // Git branch name validation rules:
    // - Cannot start with dot, slash, or hyphen
    // - Cannot contain double dots (..)
    // - Cannot contain spaces
    // - Cannot end with .lock
    // - Cannot contain special characters like ~, ^, :, ?, *, [, \, etc.
    const gitBranchRegex =
      /^(?!\/|\.|\-)(?!.*\.\.)(?!.*\.lock$)[a-zA-Z0-9\/_\-]+$/;
    return gitBranchRegex.test(name) && name.length > 0 && name.length <= 255;
  };

  const handleCreate = async () => {
    if (!branchName.trim()) {
      toast.error("Branch name cannot be empty");
      return;
    }

    if (!validateBranchName(branchName)) {
      toast.error(
        "Invalid branch name. Use only letters, numbers, hyphens, underscores, and forward slashes.",
      );
      return;
    }

    setIsCreating(true);
    try {
      await createBranch({
        projectId,
        branchName: branchName.trim(),
      });
      toast.success(`Branch "${branchName}" created`);
      setBranchName("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create branch:", error);
      toast.error("Failed to create branch");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
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
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              id="branch-name"
              placeholder="my-test-branch"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={isCreating}>
            Create Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
