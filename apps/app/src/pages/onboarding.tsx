import { useEffect, useState } from "react";
import {
  useUser,
  useOrganizationList,
  useOrganization,
} from "@clerk/clerk-react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { Loader } from "lucide-react";

type OnboardingStep =
  | "checking-auth"
  | "checking-org"
  | "checking-installation"
  | "redirecting";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded: orgLoaded, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const { organization: activeOrg } = useOrganization();

  const [step, setStep] = useState<OnboardingStep>("checking-auth");
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    slug: string | null;
  } | null>(null);

  // Check if selected org has GitHub installation
  const installation = useQuery(
    api.github.getInstallation,
    selectedOrg?.id ? {} : "skip",
  );

  useEffect(() => {
    // Step 1: Check authentication
    if (!userLoaded) {
      setStep("checking-auth");
      return;
    }

    if (!isSignedIn) {
      navigate("/sign-in");
      return;
    }

    // Step 2: Check for organization membership
    if (!orgLoaded) {
      setStep("checking-org");
      return;
    }

    // If there's already an active org, redirect to it
    if (activeOrg) {
      setStep("redirecting");
      const orgSlug = activeOrg.slug || activeOrg.id;
      navigate(`/${orgSlug}`);
      return;
    }

    const orgs = userMemberships?.data || [];

    if (orgs.length === 0) {
      // No organizations - need to install GitHub app
      setStep("redirecting");
      navigate("/new-account");
      return;
    }

    // User has organizations - select the first one
    const firstOrg = orgs[0].organization;
    if (!selectedOrg || selectedOrg.id !== firstOrg.id) {
      setSelectedOrg({
        id: firstOrg.id,
        slug: firstOrg.slug,
      });
      setStep("checking-installation");
    }
  }, [
    userLoaded,
    isSignedIn,
    orgLoaded,
    userMemberships,
    navigate,
    selectedOrg,
    activeOrg,
  ]);

  useEffect(() => {
    // Step 3: Check if org has GitHub installation
    if (selectedOrg && installation !== undefined) {
      if (installation === null) {
        // Org exists but no GitHub installation
        setStep("redirecting");
        navigate(`/new-account?orgId=${selectedOrg.id}`);
      } else {
        // All good - redirect to org dashboard
        setStep("redirecting");
        const orgSlug = selectedOrg.slug || selectedOrg.id;
        navigate(`/${orgSlug}`);
      }
    }
  }, [selectedOrg, installation, navigate]);

  const stepMessages = {
    "checking-auth": "Checking authentication...",
    "checking-org": "Loading your organizations...",
    "checking-installation": "Verifying GitHub connection...",
    redirecting: "Redirecting...",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader className="size-4 animate-spin" />
        <p className="text-sm">{stepMessages[step]}</p>
      </div>
    </div>
  );
}
