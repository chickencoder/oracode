import { useOrganizationList, UserButton } from "@clerk/clerk-react";
import { NavLink, useNavigate, useParams } from "react-router";
import { OrgDropdown } from "./OrgDropdown";
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
  const { userMemberships, isLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const orgs =
    userMemberships.data?.map((membership) => ({
      slug: membership.organization.slug!,
      name: membership.organization.name,
    })) ?? [];

  const handleOrgSelect = (newOrgSlug: string) => {
    if (newOrgSlug) {
      navigate(`/${newOrgSlug}`);
    }
  };

  return (
    <header className="bg-card mb-4">
      <div className="border-b">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto flex items-center px-4 gap-1">
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
