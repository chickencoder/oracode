import { ClerkProvider } from "@clerk/react-router";
import { dark } from "@clerk/themes";
import { useTheme } from "./theme-provider";
import { ReactNode, useEffect, useState } from "react";

interface ClerkThemeWrapperProps {
  publishableKey: string;
  children: ReactNode;
}

export function ClerkThemeWrapper({
  publishableKey,
  children,
}: ClerkThemeWrapperProps) {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");

      // Listen for system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? "dark" : "light");
      };

      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
