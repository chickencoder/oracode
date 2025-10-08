import { useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import type { UserInfo } from "@repo/convex/types";

/**
 * Custom hook to get current user info formatted for avatar display
 */
export function useCurrentUser(): UserInfo | null {
  const { user } = useUser();

  return useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.fullName || user.firstName || "User",
            avatarUrl: user.imageUrl || null,
          }
        : null,
    [user],
  );
}
