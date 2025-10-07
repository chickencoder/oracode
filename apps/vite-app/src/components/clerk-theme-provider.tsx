import { ClerkProvider } from "@clerk/react-router";
import { dark } from "@clerk/themes";
import { useTheme } from "./theme-provider";
import { useEffect, useState, type ReactNode } from "react";

interface ClerkThemeProviderProps {
  publishableKey: string;
  children: ReactNode;
}

export function ClerkThemeProvider({
  publishableKey,
  children,
}: ClerkThemeProviderProps) {
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
