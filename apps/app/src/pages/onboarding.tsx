import { OrganizationList } from "@clerk/clerk-react";

/**
 * Onboarding page that allows users to select or create an organization
 * Uses Clerk's OrganizationList for a comprehensive org selection experience
 */
export function OnboardingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <OrganizationList
        hidePersonal
        afterCreateOrganizationUrl="/new-account"
        afterSelectOrganizationUrl={(org) => `/${org.slug}`}
      />
    </div>
  );
}
