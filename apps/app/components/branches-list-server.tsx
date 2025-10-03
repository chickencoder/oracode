import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { BranchesListClient } from "./branches-list-client";
import { getToken } from "@/lib/auth-server";

type BranchesListServerProps = {
  projectId: Id<"projects">;
  orgId: string;
  searchQuery: string;
};

export async function BranchesListServer({
  projectId,
  searchQuery,
  orgId,
}: BranchesListServerProps) {
  const preloadedBranches = await preloadQuery(
    api.branches.getBranchesByProject,
    {
      projectId,
      orgId,
    },
    {
      token: await getToken(),
    },
  );

  return (
    <BranchesListClient
      preloadedBranches={preloadedBranches}
      searchQuery={searchQuery}
    />
  );
}
