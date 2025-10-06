import { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useOrgNavigation } from "../hooks/useOrgNavigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Outlet } from "react-router";

export function DashboardLayout() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, isLoaded } = useOrgNavigation(orgSlug);

  // If org not found after loading, redirect to onboarding
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate("/");
    }
  }, [isLoaded, organization, navigate]);

  return (
    <>
      <DashboardHeader />
      <Outlet />
    </>
  );
}
