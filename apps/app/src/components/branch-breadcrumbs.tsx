import { Link } from "react-router";
import { Icon } from "./icon";
import { Skeleton } from "./ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

interface BranchBreadcrumbsProps {
  orgSlug: string;
  projectId: string;
  branchName?: string;
}

export function BranchBreadcrumbs({
  orgSlug,
  projectId,
  branchName,
}: BranchBreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Logo - links to project branches page */}
        <BreadcrumbItem className="px-2">
          <BreadcrumbLink asChild>
            <Link to={`/${orgSlug}/project/${projectId}`}>
              <Icon className="h-5 w-5 text-primary" />
              <span className="sr-only">Oracode</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="text-xl text-muted-foreground/20">
          /
        </BreadcrumbSeparator>

        {/* Branch name - current page */}
        <BreadcrumbItem className="px-2 text-foreground">
          {branchName ? (
            <BreadcrumbPage className="font-medium">
              {branchName}
            </BreadcrumbPage>
          ) : (
            <Skeleton className="h-5 w-24" />
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
