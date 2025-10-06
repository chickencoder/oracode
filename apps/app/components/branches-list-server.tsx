import { preloadQuery } from "convex/nextjs";
import { api } from "@repo/convex/_generated/api";
import { Id } from "@repo/convex/_generated/dataModel";
import { BranchesListClient } from "./branches-list-client";
import { auth } from "@clerk/nextjs/server";

type BranchesListServerProps = {
  projectId: Id<"projects">;
  searchQuery: string;
};

export async function BranchesListServer({
  projectId,
  searchQuery,
}: BranchesListServerProps) {
  const { getToken } = await auth();
  const preloadedBranches = await preloadQuery(
    api.branches.getBranchesByProject,
    {
      projectId,
    },
    {
      token: await getToken({ template: "convex" }),
    },
  );

  return (
    <BranchesListClient
      preloadedBranches={preloadedBranches}
      searchQuery={searchQuery}
    />
  );
}
