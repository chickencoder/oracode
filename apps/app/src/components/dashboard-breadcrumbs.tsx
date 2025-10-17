import { useMemo } from "react";
import { Link } from "react-router";
import { OrgDropdown } from "./org-dropdown";
import { ProjectDropdown } from "./project-dropdown";
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
import type { Id } from "@repo/convex/_generated/dataModel";
import type { Org, Project } from "@/types/dashboard";

interface DashboardBreadcrumbsProps {
  // Org level (always present)
  orgs: Org[];
  currentOrgSlug?: string;
  onOrgSelect: (orgSlug: string) => void;
  isOrgsLoading?: boolean;

  // Project level (optional)
  projects?: Project[];
  currentProjectSlug?: string; // From URL for immediate display
  onProjectSelect?: (projectId: Id<"projects">) => void;
  isProjectsLoading?: boolean;

  // Branch level (optional)
  branchId?: Id<"branches">;
}

export function DashboardBreadcrumbs({
  orgs,
  currentOrgSlug,
  onOrgSelect,
  isOrgsLoading,
  projects,
  currentProjectSlug,
  onProjectSelect,
  isProjectsLoading,
  branchId,
}: DashboardBreadcrumbsProps) {
  // Memoize the current org lookup to avoid repeated finds
  const currentOrg = useMemo(
    () => orgs.find((org) => org.slug === currentOrgSlug),
    [orgs, currentOrgSlug],
  );

  const currentProject = useMemo(
    () => projects?.find((p) => p.slug === currentProjectSlug),
    [projects, currentProjectSlug],
  );

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Logo - always links to home */}
        <BreadcrumbItem className="px-2">
          <BreadcrumbLink asChild>
            <Link to={`/${currentOrgSlug}`}>
              <Icon className="h-5 w-5 text-primary" />
              <span className="sr-only">Oracode</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator className="text-xl text-muted-foreground/20">
          /
        </BreadcrumbSeparator>

        {/* Org level - always a dropdown */}
        <BreadcrumbItem className="px-2 text-foreground">
          {isOrgsLoading || !currentOrgSlug ? (
            <Skeleton className="h-7 w-40" />
          ) : (
            <div className="flex items-center gap-1">
              <img
                src={`https://github.com/${currentOrgSlug}.png?s=40`}
                alt={currentOrg?.name}
                className="size-5 rounded-full mr-1"
                onError={(e) => {
                  // Fallback to a simple gray circle on error
                  e.currentTarget.style.display = "none";
                }}
              />
              <BreadcrumbLink asChild>
                <Link className="font-medium" to={`/${currentOrgSlug}`}>
                  {currentOrg?.name || currentOrgSlug}
                </Link>
              </BreadcrumbLink>
              <OrgDropdown
                orgs={orgs}
                value={currentOrgSlug}
                onSelect={onOrgSelect}
                isLoading={isOrgsLoading}
              />
            </div>
          )}
        </BreadcrumbItem>

        {/* Project level - dropdown or link depending on context */}
        {currentProjectSlug && (
          <>
            <BreadcrumbSeparator className="text-xl text-muted-foreground/20">
              /
            </BreadcrumbSeparator>
            <BreadcrumbItem className="px-2 text-foreground">
              <div className="flex items-center gap-1">
                <BreadcrumbLink asChild>
                  <Link
                    className="font-medium"
                    to={`/${currentOrgSlug}/${currentProjectSlug}`}
                  >
                    {currentProject?.name || currentProjectSlug}
                  </Link>
                </BreadcrumbLink>
                {currentProject && (
                  <ProjectDropdown
                    projects={projects ?? []}
                    value={currentProject._id}
                    onSelect={onProjectSelect}
                    isLoading={isProjectsLoading}
                  />
                )}
              </div>
            </BreadcrumbItem>
          </>
        )}

        {/* Branch level - plain text (current page) */}
        {branchId && (
          <>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Branch</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
