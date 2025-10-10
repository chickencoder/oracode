import { useEffect } from "react";
import { useParams, useNavigate, NavLink, Outlet } from "react-router";
import { useOrganizationList, useOrganization, UserButton } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { OrgDropdown } from "@/components/org-dropdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  {
    label: "Sessions",
    href: "",
  },
  {
    label: "Settings",
    href: "/settings",
  },
];

export function ProjectLayout() {
  const navigate = useNavigate();
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const { organization: activeOrg } = useOrganization();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const project = useQuery(
    api.projects.getProjectById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const orgs =
    userMemberships.data?.map((membership) => ({
      slug: membership.organization.slug!,
      name: membership.organization.name,
    })) ?? [];

  // If the active org is not in the list yet (e.g., just created), add it as fallback
  if (activeOrg && activeOrg.slug && !orgs.find(org => org.slug === activeOrg.slug)) {
    orgs.unshift({
      slug: activeOrg.slug,
      name: activeOrg.name,
    });
  }

  const handleOrgSelect = async (newOrgSlug: string) => {
    if (newOrgSlug) {
      // Find the org by slug to get its ID
      const selectedOrg = userMemberships.data?.find(
        (m) => m.organization.slug === newOrgSlug
      );

      if (selectedOrg) {
        // Set as active organization before navigating
        await setActive?.({ organization: selectedOrg.organization.id });
      }

      navigate(`/${newOrgSlug}`);
    }
  };

  // If project not found after loading, redirect to org page
  useEffect(() => {
    if (project === null) {
      navigate(`/${orgSlug}`);
    }
  }, [project, orgSlug, navigate]);

  return (
    <>
      <header className="bg-card mb-4">
        <div className="border-b">
          <div className="flex items-center justify-between p-4">
            <OrgDropdown
              orgs={orgs}
              value={orgSlug}
              onSelect={handleOrgSelect}
              isLoading={!isLoaded}
            />
            <div className="flex items-center gap-4">
              <span className="rounded-full border size-8 flex items-center justify-center">
                <UserButton />
              </span>
            </div>
          </div>
        </div>
        <nav className="border-b">
          <div className="flex items-center px-4 gap-1">
            {tabs.map((tab) => {
              const fullPath = orgSlug && projectId ? `/${orgSlug}/project/${projectId}${tab.href}` : tab.href;
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
      <Outlet />
    </>
  );
}
