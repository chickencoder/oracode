import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useOrgNavigation } from "../hooks/use-org-navigation";
import { useOrgSelection } from "../hooks/use-org-selection";
import { DashboardHeader } from "@/components/dashboard-header";
import { Outlet } from "react-router";
import type { Tab } from "@/types/dashboard";

const tabs: Tab[] = [
  {
    label: "Projects",
    href: "",
  },
  {
    label: "Settings",
    href: "/settings",
  },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, isLoaded } = useOrgNavigation(orgSlug);
  const { orgs, isOrgsLoaded, handleOrgSelect } = useOrgSelection();

  // If org not found after loading, redirect to onboarding
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate("/");
    }
  }, [isLoaded, organization, navigate]);

  return (
    <>
      <DashboardHeader
        tabs={tabs}
        basePath={`/${orgSlug}`}
        orgs={orgs}
        currentOrgSlug={orgSlug}
        onOrgSelect={handleOrgSelect}
        isOrgsLoading={!isOrgsLoaded}
      />
      <Outlet />
    </>
  );
}
