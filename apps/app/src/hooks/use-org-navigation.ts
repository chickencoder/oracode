import { useEffect, useRef } from "react";
import { useOrganization, useClerk } from "@clerk/clerk-react";

/**
 * Sets the active organization based on the URL slug parameter
 * Ensures the Clerk organization context matches the current route
 */
export function useOrgNavigation(orgSlug: string | undefined) {
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useClerk();
  const isSettingActiveRef = useRef(false);

  useEffect(() => {
    // Only run when the org slug changes and doesn't match current org
    if (
      orgSlug &&
      isLoaded &&
      !isSettingActiveRef.current &&
      (!organization || organization.slug !== orgSlug)
    ) {
      isSettingActiveRef.current = true;
      setActive({ organization: orgSlug })
        .catch((err) => {
          console.error("Failed to set active organization:", err);
        })
        .finally(() => {
          isSettingActiveRef.current = false;
        });
    }
  }, [orgSlug, isLoaded]); // Remove organization and setActive from deps

  return { organization, isLoaded };
}
