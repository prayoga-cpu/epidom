"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One setup question. Remounted per screen (give it a `key`), so each one
 * fades in and slides a little: up when moving on, down when going back.
 * Reduced-motion users get no movement.
 */
export function FlowScreen({
  children,
  direction = "forward",
  className,
}: {
  children: React.ReactNode;
  direction?: "forward" | "back";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "animate-in fade-in flex min-h-0 flex-1 flex-col duration-500 motion-reduce:animate-none",
        direction === "forward" ? "slide-in-from-bottom-6" : "slide-in-from-top-6",
        className
      )}
    >
      {children}
    </section>
  );
}

/** The question's big title, focused on arrival so a screen reader announces it. */
export function FlowTitle({
  children,
  eyebrow,
  subtitle,
  focusOnMount = true,
}: {
  children: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  focusOnMount?: boolean;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <div className="space-y-2">
      {eyebrow ? <p className="text-muted-foreground text-sm">{eyebrow}</p> : null}
      <h1
        ref={ref}
        tabIndex={-1}
        className="text-foreground text-3xl leading-tight font-bold tracking-tight outline-none sm:text-4xl"
      >
        {children}
      </h1>
      {subtitle ? <p className="text-muted-foreground text-base">{subtitle}</p> : null}
    </div>
  );
}
