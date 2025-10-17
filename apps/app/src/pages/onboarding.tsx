import { useEffect } from "react";
import { useUser, useOrganizationList } from "@clerk/clerk-react";
import { useNavigate } from "react-router";
import { Loader } from "lucide-react";

/**
 * Onboarding page that redirects users to their organization
 * Personal accounts are disabled - all users must have an organization
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded: orgLoaded, userMemberships } = useOrganizationList({
    userMemberships: true,
  });

  useEffect(() => {
    // Wait for data to load
    if (!userLoaded || !orgLoaded) return;

    // Check authentication
    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }

    const orgs = userMemberships?.data || [];

    if (orgs.length === 0) {
      // No organizations - redirect to account setup
      navigate("/new-account");
      return;
    }

    // User has at least one org - redirect to first org's dashboard
    // The dashboard will handle setting active org via useOrgNavigation
    const firstOrg = orgs[0].organization;
    const orgSlug = firstOrg.slug || firstOrg.id;
    navigate(`/${orgSlug}`);
  }, [userLoaded, isSignedIn, orgLoaded, userMemberships, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader className="size-4 animate-spin" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
