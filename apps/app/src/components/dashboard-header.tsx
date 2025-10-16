import { UserButton } from "@clerk/clerk-react";
import { NavLink } from "react-router";
import { DashboardBreadcrumbs } from "./dashboard-breadcrumbs";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@repo/convex/_generated/dataModel";
import type { Org, Project, Tab } from "@/types/dashboard";

interface DashboardHeaderProps {
  // Tab configuration
  tabs: Tab[];
  basePath: string;

  // Breadcrumb configuration
  orgs: Org[];
  currentOrgSlug?: string;
  onOrgSelect: (orgSlug: string) => void;
  isOrgsLoading?: boolean;

  // Project breadcrumb (optional)
  projects?: Project[];
  currentProjectSlug?: string; // From URL for immediate display
  onProjectSelect?: (projectId: Id<"projects">) => void;
  isProjectsLoading?: boolean;

  // Branch breadcrumb (optional)
  branchId?: Id<"branches">;
}

export function DashboardHeader({
  tabs,
  basePath,
  orgs,
  currentOrgSlug,
  onOrgSelect,
  isOrgsLoading,
  projects,
  currentProjectSlug,
  onProjectSelect,
  isProjectsLoading,
  branchId,
}: DashboardHeaderProps) {
  return (
    <header className="bg-card mb-4 relative">
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <DashboardBreadcrumbs
            orgs={orgs}
            currentOrgSlug={currentOrgSlug}
            onOrgSelect={onOrgSelect}
            isOrgsLoading={isOrgsLoading}
            projects={projects}
            currentProjectSlug={currentProjectSlug}
            onProjectSelect={onProjectSelect}
            isProjectsLoading={isProjectsLoading}
            branchId={branchId}
          />
          <div className="flex items-center gap-4">
            <span className="rounded-full border size-8 flex items-center justify-center">
              <UserButton />
            </span>
          </div>
        </div>
      </div>
      <nav className="border-b sticky top-0">
        <div className="flex items-center px-4 gap-1">
          {tabs.map((tab) => {
            const fullPath = `${basePath}${tab.href}`;
            return (
              <NavLink
                key={tab.href}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    "border-b-2 py-2",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground",
                  )
                }
                to={fullPath}
                end={tab.href === ""}
              >
                <Button variant="ghost" asChild>
                  <span>{tab.label}</span>
                </Button>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
