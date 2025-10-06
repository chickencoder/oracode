import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { ClerkProvider, useAuth } from "@clerk/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { SignInPage } from "./pages/SignIn.tsx";
import { OnboardingPage } from "./pages/Onboarding.tsx";
import { OrgDashboardPage } from "./pages/OrgDashboard.tsx";
import { InstallGitHubAppPage } from "./pages/InstallGitHubApp.tsx";

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
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <Routes>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route
              path="/install-github-app"
              element={<InstallGitHubAppPage />}
            />
            <Route path="/:orgSlug" element={<OrgDashboardPage />} />
          </Routes>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
);
