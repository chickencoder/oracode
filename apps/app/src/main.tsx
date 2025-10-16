import "./index.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { useAuth } from "@clerk/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { ClerkThemeProvider } from "./components/clerk-theme-provider";
import { SignInPage } from "./pages/sign-in";
import { OnboardingPage } from "./pages/onboarding";
import { NewAccountPage } from "./pages/new-account";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { ProjectLayout } from "./layouts/project-layout";
import { ProjectSettingsLayout } from "./layouts/project-settings-layout";
import { OrgSettingsLayout } from "./layouts/org-settings-layout";
import { ProjectsPage } from "./pages/projects";
import { ProjectBranchesPage } from "./pages/project-branches";
import { GeneralSettingsPage } from "./pages/project-settings/index";
import { DevelopmentSettingsPage } from "./pages/project-settings/sandbox";
import { EnvironmentVariablesPage } from "./pages/project-settings/environment";
import { OrgGeneralSettingsPage } from "./pages/org-settings/index";
import { ClaudeCodeSettingsPage } from "./pages/org-settings/claude-code";
import { BranchPage } from "./pages/branch";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Failed to load Clerk Publishable Key");
}

// Initialize Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <NuqsAdapter>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <ClerkThemeProvider publishableKey={PUBLISHABLE_KEY}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <Toaster position="bottom-right" />
              <Routes>
                <Route path="/" element={<OnboardingPage />} />
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/new-account" element={<NewAccountPage />} />
                <Route path="/:orgSlug" element={<DashboardLayout />}>
                  <Route index element={<ProjectsPage />} />
                  <Route path="settings" element={<OrgSettingsLayout />}>
                    <Route index element={<OrgGeneralSettingsPage />} />
                    <Route path="claude-code" element={<ClaudeCodeSettingsPage />} />
                  </Route>
                </Route>
                <Route path="/:orgSlug/:projectSlug" element={<ProjectLayout />}>
                  <Route index element={<ProjectBranchesPage />} />
                  <Route path="settings" element={<ProjectSettingsLayout />}>
                    <Route index element={<GeneralSettingsPage />} />
                    <Route path="sandbox" element={<DevelopmentSettingsPage />} />
                    <Route path="environment" element={<EnvironmentVariablesPage />} />
                  </Route>
                </Route>
                <Route
                  path="/:orgSlug/:projectSlug/:branchName"
                  element={<BranchPage />}
                />
              </Routes>
            </ConvexProviderWithClerk>
          </ClerkThemeProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </BrowserRouter>
  </StrictMode>,
);
