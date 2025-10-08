import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function LoadingText({
  children,
  className,
  duration = 1000,
  delay = 0,
  interval = 0,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  interval?: number;
}) {
  const totalCycleDuration = duration + interval;

  return (
    <span
      style={{
        animationDuration: `${totalCycleDuration}ms`,
        animationDelay: `${delay}ms`,
      }}
      className={cn(
        "from-foreground/30 via-foreground to-foreground/30 animate-shine relative inline-block bg-gradient-to-r bg-[length:200%_100%] bg-clip-text text-sm text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
