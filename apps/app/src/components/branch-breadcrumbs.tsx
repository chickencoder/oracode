import { Link } from "react-router";
import { Icon } from "./icon";
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
  projectSlug: string;
  projectName?: string;
  branchName: string;
}

export function BranchBreadcrumbs({
  orgSlug,
  projectSlug,
  projectName,
  branchName,
}: BranchBreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Logo - links to project branches page */}
        <BreadcrumbItem className="px-2">
          <BreadcrumbLink asChild>
            <Link to={`/${orgSlug}/${projectSlug}`}>
              <Icon className="h-5 w-5 text-primary" />
              <span className="sr-only">Oracode</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="text-xl text-muted-foreground/20">
          /
        </BreadcrumbSeparator>

        {/* Project name - show slug first, then replace with name when loaded */}
        <BreadcrumbItem className="px-2 text-foreground">
          <BreadcrumbLink asChild>
            <Link to={`/${orgSlug}/${projectSlug}`}>
              <span className="font-medium">{projectName || projectSlug}</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="text-xl text-muted-foreground/20">
          /
        </BreadcrumbSeparator>

        {/* Branch name - always from URL */}
        <BreadcrumbItem className="px-2 text-foreground">
          <BreadcrumbPage className="font-medium">{branchName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
