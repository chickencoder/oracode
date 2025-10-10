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
import { ProjectsPage } from "./pages/projects";
import { ProjectSessionsPage } from "./pages/project-sessions";
import { ProjectSettingsPage } from "./pages/project-settings";
import { SettingsPage } from "./pages/settings";
import { SessionPage } from "./pages/session";

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
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="/:orgSlug/project/:projectId" element={<ProjectLayout />}>
                  <Route index element={<ProjectSessionsPage />} />
                  <Route path="settings" element={<ProjectSettingsPage />} />
                </Route>
                <Route
                  path="/:orgSlug/sessions/:sessionId"
                  element={<SessionPage />}
                />
              </Routes>
            </ConvexProviderWithClerk>
          </ClerkThemeProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </BrowserRouter>
  </StrictMode>,
);
