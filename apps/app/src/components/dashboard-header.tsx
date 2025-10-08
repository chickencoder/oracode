import { useOrganizationList, useOrganization, UserButton } from "@clerk/clerk-react";
import { NavLink, useNavigate, useParams } from "react-router";
import { OrgDropdown } from "./org-dropdown";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  {
    label: "Projects",
    href: "",
  },
  {
    label: "Settings",
    href: "/settings",
  },
];

export function DashboardHeader() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization: activeOrg } = useOrganization();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

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

  return (
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
            const fullPath = orgSlug ? `/${orgSlug}${tab.href}` : tab.href;
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
