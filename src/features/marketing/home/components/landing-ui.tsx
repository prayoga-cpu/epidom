"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { BadgePlan } from "../data/problems";

/**
 * Small building blocks shared by the home page sections. Everything is at
 * least 44px tall where it can be tapped, and nothing depends on hover.
 */

export const PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-transparent bg-epi-gold-500 px-7 py-3 text-center text-sm font-medium tracking-[0.06em] text-epi-navy-900 uppercase shadow-[0_8px_24px_-10px_rgba(217,174,59,0.6)] transition-transform motion-safe:hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

export const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-7 py-3 text-center text-sm font-medium tracking-[0.06em] text-epi-cream-50 uppercase transition-[transform,border-color] hover:border-white/40 motion-safe:hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

/** A text link with a 44px tap area. */
export const TEXT_LINK =
  "inline-flex min-h-11 items-center text-sm text-epi-gold-400 underline decoration-epi-gold-500/50 underline-offset-4 hover:decoration-epi-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

const PLAN_KEY: Record<BadgePlan | "ENTERPRISE", string> = {
  FREE: "redesign.landing.plans.free",
  POS: "redesign.landing.plans.pos",
  OPERATIONS: "redesign.landing.plans.operations",
  ENTERPRISE: "redesign.landing.plans.enterprise",
};

export function PlanBadge({
  plan,
  className,
}: {
  plan: BadgePlan | "ENTERPRISE";
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-[0.12em] uppercase",
        plan === "FREE"
          ? "text-epi-cream-50/80 border-white/20"
          : "border-epi-gold-500/40 bg-epi-gold-500/10 text-epi-gold-300",
        className
      )}
    >
      {t(PLAN_KEY[plan])}
    </span>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  sub,
  align = "left",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <div className="epi-eyebrow mb-4">{eyebrow}</div> : null}
      <h2
        id={id}
        className="epi-display text-epi-cream-50 m-0 text-[clamp(36px,5vw,64px)] leading-[0.95]"
      >
        {title}
      </h2>
      {sub ? (
        <p className="text-epi-cream-50/70 mt-5 text-base leading-relaxed sm:text-[17px]">{sub}</p>
      ) : null}
    </div>
  );
}
