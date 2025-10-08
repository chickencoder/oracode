"use client";

import Image from "next/image";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      toast.success("Thanks. We'll email you when it's live.");
      setEmail("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="max-w-5xl mx-auto p-4 pt-20 min-h-screen">
      <main className="flex flex-col items-center justify-center text-center h-full">
        <a
          href="https://www.oracode.dev"
          className="flex items-center gap-1.5 mb-8"
        >
          <Icon className="size-4 text-primary" />
          <span className="text-xl font-[550]">Oracode</span>
        </a>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tighter leading-normal mb-6">
          Ship with{" "}
          <span className="hover:-rotate-1 hover:scale-[1.05] transition-transform cursor-default rounded-sm bg-muted px-2 gap-2 inline-flex items-center text-foreground">
            <Image
              src="/claude.png"
              alt="Claude Code"
              width={32}
              height={32}
              className="inline-block size-6 md:size-8"
            />
            Claude Code
          </span>{" "}
          in the Browser
        </h1>
        <p className="text-muted-foreground text-balance max-w-xl mb-8">
          Prototype features and open PRs without touching the terminal. Just
          connect GitHub and start vibe coding.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mb-4 inline-flex flex-col items-center gap-2"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Input
              type="email"
              placeholder="Your email address"
              className="w-48 md:w-64"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Notify me
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
