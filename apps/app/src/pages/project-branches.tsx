import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GitBranch, SearchIcon, MoreVertical, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { CreateBranchDialog } from "@/components/create-branch-dialog";
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
        <CreateBranchDialog
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
        <div className="border rounded-lg bg-card">
          <div className="divide-y">
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
          </div>
        </div>
      ) : filteredBranches && filteredBranches.length > 0 ? (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableBody>
              {filteredBranches.map((branch) => (
                <TableRow
                  key={branch._id}
                  className="cursor-pointer"
                  onClick={() => handleBranchClick(branch._id)}
                >
                  <TableCell className="font-medium pl-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      {branch.branchName}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(branch.createdAt, {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {branch.sandboxStatus === "ready" ? (
                      <Badge
                        variant="outline"
                        className="border-green-600/20 bg-green-600/10 text-green-600 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-400"
                      >
                        Ready
                      </Badge>
                    ) : branch.sandboxStatus === "creating" ? (
                      <Badge
                        variant="outline"
                        className="border-yellow-600/20 bg-yellow-600/10 text-yellow-600 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
                      >
                        Creating
                      </Badge>
                    ) : branch.sandboxStatus === "error" ? (
                      <Badge
                        variant="outline"
                        className="border-red-600/20 bg-red-600/10 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-400"
                      >
                        Error
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Not started
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-[50px]">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleDeleteClick(branch._id, branch.branchName, e)
                          }
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete branch
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
