"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { BadgePlan } from "../data/problems";

/**
 * Small building blocks shared by the marketing sections, so every section
 * speaks the same design language: pill buttons (gold, outline, light), one
 * card surface, one heading rhythm. Everything is at least 44px tall where it
 * can be tapped, nothing depends on hover, and every button answers a press
 * (it settles back and shrinks a touch, as lovable.dev's do).
 */

export const PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-0 bg-[linear-gradient(180deg,#f4dc90,#d7b54b_55%,#a97c1c)] px-7 py-3 text-center text-[15px] font-semibold text-[#151004] shadow-[0_0_0_1px_rgba(255,255,255,.28)_inset,0_8px_28px_rgba(217,174,59,.35),0_3px_0_rgba(139,90,10,.85)] transition-[transform,box-shadow] duration-150 hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.98] hover:shadow-[0_0_0_1px_rgba(255,255,255,.38)_inset,0_16px_40px_rgba(217,174,59,.5),0_3px_0_rgba(139,90,10,.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

export const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-7 py-3 text-center text-[15px] font-medium text-epi-cream-50 transition-[transform,border-color,background-color] duration-150 hover:border-white/40 hover:bg-white/[0.04] motion-safe:hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

/**
 * The marketing site's palette is navy, gold and this ONE accent gradient,
 * nothing else (owner's rule, 2026-11-06; the footer's sunset illustration was
 * the one exception until it became a navy-and-gold photo scene, 2026-11-11):
 * deep navy rising into violet, lit
 * from below by a pink-violet glow with a blue one just above it. It first
 * appeared as the POS tour's stage. `x`/`y` move the glow (percent of the box)
 * so cards side by side don't look stamped out; the defaults are the stage's.
 * Returned as a `background-image` value (an inline style, so it always
 * reaches the browser, unlike a brand-new arbitrary Tailwind class).
 */
export function aurora({ x = 50, y = 105 }: { x?: number; y?: number } = {}): string {
  return [
    `radial-gradient(ellipse 90% 55% at ${x}% ${y}%, rgba(244,114,182,0.6), transparent 70%)`,
    `radial-gradient(ellipse 70% 50% at ${x}% ${y - 20}%, rgba(96,128,255,0.55), transparent 70%)`,
    "linear-gradient(180deg, #0d1730, #14234a 55%, #3a2a78)",
  ].join(", ");
}

/** A pill on a coloured or photo surface (a bright card, the cream panel): white, dark text. */
export const LIGHT_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#0a1020] shadow-[0_6px_20px_rgba(10,16,32,0.18)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(10,16,32,0.26)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

/** A round 44px icon button (carousel arrows, play/pause), on dark. */
export const ICON_BUTTON =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-epi-cream-50/85 backdrop-blur transition-[background-color,border-color,transform] duration-150 hover:border-white/30 hover:bg-white/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epi-gold-300";

/** The one card surface on dark: 24px radius, hairline border, a faint top light. */
export const CARD =
  "rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015]";

/** A card that can be hovered: the border brightens and it lifts by 2px. */
export const CARD_INTERACTIVE =
  "transition-[border-color,transform] duration-300 hover:border-white/20 motion-safe:hover:-translate-y-0.5";

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
  tone = "dark",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "left" | "center";
  /** "light" on the cream panel: navy text, a deeper gold eyebrow. */
  tone?: "dark" | "light";
}) {
  // Rises in as it scrolls into view (data-reveal, see reveal-root.tsx).
  return (
    <div data-reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? (
        <div className={cn("epi-eyebrow mb-4", tone === "light" && "text-epi-gold-600")}>
          {eyebrow}
        </div>
      ) : null}
      <h2
        id={id}
        className={cn(
          "epi-display m-0 text-[clamp(36px,5vw,64px)] leading-[0.95]",
          tone === "light" ? "text-epi-navy-900" : "text-epi-cream-50"
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-[17px]",
            tone === "light" ? "text-epi-navy-700" : "text-epi-cream-50/70"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
