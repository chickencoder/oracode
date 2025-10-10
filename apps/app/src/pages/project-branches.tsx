import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Card, CardTitle, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GitBranch, SearchIcon, MoreVertical, Trash2 } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateBranchModal } from "@/components/create-branch-modal";
import { toast } from "sonner";

export function ProjectBranchesPage() {
  const { orgSlug, projectId } = useParams<{
    orgSlug: string;
    projectId: string;
  }>();
  const navigate = useNavigate();
  const [search, setSearch] = useQueryState("q", { defaultValue: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<{
    id: Id<"branches">;
    name: string;
  } | null>(null);
  const deleteBranch = useMutation(api.branches.deleteBranch);

  const branches = useQuery(
    api.branches.getBranchesByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const handleCreateBranch = () => {
    setIsModalOpen(true);
  };

  const handleBranchClick = (branchId: Id<"branches">) => {
    navigate(`/${orgSlug}/branches/${branchId}`);
  };

  const handleDeleteClick = (
    branchId: Id<"branches">,
    branchName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setBranchToDelete({ id: branchId, name: branchName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;

    try {
      await deleteBranch({ branchId: branchToDelete.id });
      toast.success(`Branch "${branchToDelete.name}" deleted`);
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
    } catch (error) {
      console.error("Failed to delete branch:", error);
      toast.error("Failed to delete branch");
    }
  };

  // Filter branches based on search query
  const filteredBranches = useMemo(() => {
    if (!branches || !search) return branches;

    const query = search.toLowerCase();
    return branches.filter((branch) =>
      branch.branchName.toLowerCase().includes(query),
    );
  }, [branches, search]);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        <InputGroup className="max-w-72 bg-card">
          <InputGroupInput
            placeholder="Search branches"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>

        <Button onClick={handleCreateBranch}>New Branch</Button>
      </div>

      {projectId && orgSlug && (
        <CreateBranchModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          projectId={projectId as Id<"projects">}
          orgSlug={orgSlug}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{branchToDelete?.name}"? This
              will permanently delete the branch and all its messages. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {branches === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredBranches && filteredBranches.length > 0 ? (
        <div className="space-y-3">
          {filteredBranches.map((branch) => (
            <Card
              key={branch._id}
              className="cursor-pointer hover:bg-accent/50 transition-colors rounded-md shadow-xs relative"
              onClick={() => handleBranchClick(branch._id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="font-medium tracking-tight text-lg flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {branch.branchName}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(branch.createdAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-4 right-4"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) =>
                          handleDeleteClick(branch._id, branch.branchName, e)
                        }
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                        Delete branch
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="border border-dashed min-h-[500px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitBranch />
            </EmptyMedia>
            <EmptyTitle>No branches found</EmptyTitle>
            <EmptyDescription>
              {search
                ? `No branches found matching "${search}"`
                : "Create a new branch to get started"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </main>
  );
}
