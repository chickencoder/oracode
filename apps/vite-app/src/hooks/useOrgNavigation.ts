import { useEffect } from "react";
import { useOrganization, useClerk } from "@clerk/clerk-react";

/**
 * Sets the active organization based on the URL slug parameter
 * Ensures the Clerk organization context matches the current route
 */
export function useOrgNavigation(orgSlug: string | undefined) {
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useClerk();

  useEffect(() => {
    if (orgSlug && isLoaded && (!organization || organization.slug !== orgSlug)) {
      setActive({ organization: orgSlug });
    }
  }, [orgSlug, isLoaded, organization, setActive]);

  return { organization, isLoaded };
}
