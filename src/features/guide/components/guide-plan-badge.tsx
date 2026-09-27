"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

/** The plans the guide names. POS_TRIAL is the POS badge with its 14-day trial. */
export type GuidePlan = "FREE" | "POS" | "POS_TRIAL" | "OPERATIONS";

const LABEL_KEYS: Record<GuidePlan, string> = {
  FREE: "setupGuide.plan.free",
  POS: "setupGuide.plan.pos",
  POS_TRIAL: "setupGuide.plan.posTrial",
  OPERATIONS: "setupGuide.plan.operations",
};

interface GuidePlanBadgeProps {
  plan: GuidePlan;
  className?: string;
}

/**
 * A small plan chip for the welcome tour and the setup checklist. Free reads
 * neutral; a paid plan reads in the brand gold, like the sidebar's locked rows.
 */
export function GuidePlanBadge({ plan, className }: GuidePlanBadgeProps) {
  const { t } = useI18n();
  return (
    <span
      data-plan={plan}
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap",
        plan === "FREE"
          ? "border-border bg-muted text-muted-foreground"
          : "border-epi-gold-500/40 bg-epi-gold-500/15 text-epi-gold-700 dark:text-epi-gold-300",
        className
      )}
    >
      {t(LABEL_KEYS[plan])}
    </span>
  );
}
