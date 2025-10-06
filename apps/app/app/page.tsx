"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();

  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-7xl font-medium tracking-tighter mb-8">oracode</h1>
      <p className="font-mono text-sm text-muted-foreground mb-12">
        Claude Code in your browser
      </p>
      <SignedOut>
        <SignInButton mode="modal">
          <Button>Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button onClick={() => router.push("/projects")}>
          Continue to projects
        </Button>
      </SignedIn>
    </main>
  );
}
