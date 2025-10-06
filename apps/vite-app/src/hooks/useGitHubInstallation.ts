import { useEffect, useState } from "react";
import { useOrganizationList } from "@clerk/clerk-react";
import { useSearchParams, useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { getGitHubAvatarUrl, normalizeOrgSlug } from "../lib/constants";

type InstallationStatus = "idle" | "linking" | "creating" | "processing";

export function useGitHubInstallation(existingOrgId?: string | null) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<InstallationStatus>("idle");
  const [hasProcessedCallback, setHasProcessedCallback] = useState(false);

  const {
    isLoaded: orgLoaded,
    userMemberships,
  } = useOrganizationList({ userMemberships: true });

  const linkOrganizationToInstallation = useMutation(
    api.github.linkOrganizationToInstallation,
  );

  useEffect(() => {
    const installationStatus = searchParams.get("installation");
    const githubOrg = searchParams.get("githubOrg");

    // Wait for orgs to load before processing callback
    if (!orgLoaded || !userMemberships) return;

    if (
      installationStatus === "success" &&
      githubOrg &&
      status === "idle" &&
      !hasProcessedCallback
    ) {
      setHasProcessedCallback(true);

      const githubAvatar = getGitHubAvatarUrl(githubOrg);

      if (existingOrgId) {
        // Linking to existing org
        setStatus("linking");
        linkOrganizationToInstallation({
          orgId: existingOrgId,
          githubOrgLogin: githubOrg,
        })
          .then(() => {
            const org = userMemberships?.data?.find(
              (m) => m.organization.id === existingOrgId
            );
            const orgSlug = org?.organization.slug || existingOrgId;
            navigate(`/${orgSlug}`, { replace: true });
          })
          .catch((error) => {
            console.error("Failed to link installation:", error);
            setStatus("idle");
            setHasProcessedCallback(false);
          });
      } else {
        // Check if org already exists with this GitHub org name
        const expectedSlug = normalizeOrgSlug(githubOrg);
        const existingOrg = userMemberships.data?.find(
          (m) =>
            m.organization.slug === expectedSlug ||
            m.organization.name === githubOrg
        );

        if (existingOrg) {
          // Org already exists, link installation and optionally update avatar
          setStatus("linking");

          // Update org image if org doesn't have a custom image
          if (!existingOrg.organization.hasImage) {
            existingOrg.organization.setLogo({ file: githubAvatar }).catch((err) => {
              console.warn("Failed to update org image:", err);
            });
          }

          linkOrganizationToInstallation({
            orgId: existingOrg.organization.id,
            githubOrgLogin: githubOrg,
          })
            .then(() => {
              navigate(`/${existingOrg.organization.slug}`, { replace: true });
            })
            .catch((error) => {
              console.error("Failed to link installation:", error);
              setStatus("idle");
              setHasProcessedCallback(false);
            });
        } else {
          // Create new Clerk organization with GitHub org name and avatar
          setStatus("creating");
          // Note: createOrganization will be called from the component
          // since it comes from useOrganizationList and needs to be passed in
        }
      }
    } else if (installationStatus === "error") {
      console.error("GitHub App installation failed");
    }
  }, [
    searchParams,
    navigate,
    linkOrganizationToInstallation,
    existingOrgId,
    userMemberships,
    status,
    orgLoaded,
    hasProcessedCallback,
  ]);

  return {
    status,
    isLoading: status === "linking" || status === "creating" || status === "processing",
    isLinking: status === "linking",
    isCreating: status === "creating",
    setStatus,
  };
}
