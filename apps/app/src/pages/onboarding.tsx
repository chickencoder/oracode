import { useEffect } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { useNavigate } from "react-router";
import { Loader } from "lucide-react";

/**
 * Onboarding page that redirects users based on org status
 * - No org: Redirect to /new-account to connect GitHub
 * - Has org: Redirect to org dashboard
 */
export function OnboardingPage() {
  const { organization, isLoaded } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded) return;

    if (organization) {
      // User has an org, redirect to dashboard
      const orgSlug = organization.slug || organization.id;
      navigate(`/${orgSlug}`, { replace: true });
    } else {
      // User has no org, redirect to connect GitHub
      navigate("/new-account", { replace: true });
    }
  }, [isLoaded, organization, navigate]);

  // Show loading while checking org status
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader className="size-4 animate-spin" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
