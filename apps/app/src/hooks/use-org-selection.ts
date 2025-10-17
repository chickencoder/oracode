import { useNavigate } from "react-router";
import { useOrganizationList, useOrganization } from "@clerk/clerk-react";
import type { Org } from "@/types/dashboard";

export function useOrgSelection() {
  const navigate = useNavigate();
  const { organization: activeOrg } = useOrganization();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const orgs: Org[] =
    userMemberships.data?.map((membership) => ({
      slug: membership.organization.slug!,
      name: membership.organization.name,
    })) ?? [];

  // If the active org is not in the list yet (e.g., just created), add it as fallback
  if (
    activeOrg &&
    activeOrg.slug &&
    !orgs.find((org) => org.slug === activeOrg.slug)
  ) {
    orgs.unshift({
      slug: activeOrg.slug,
      name: activeOrg.name,
    });
  }

  const handleOrgSelect = async (newOrgSlug: string) => {
    if (newOrgSlug) {
      // Set as active organization by slug before navigating
      await setActive?.({ organization: newOrgSlug });

      // Navigate to the org's page - useOrgNavigation will sync the active org
      navigate(`/${newOrgSlug}`);
    }
  };

  return {
    orgs,
    isOrgsLoaded: isLoaded,
    handleOrgSelect,
    activeOrg,
  };
}
