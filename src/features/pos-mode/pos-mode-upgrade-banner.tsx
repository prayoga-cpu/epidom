"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { PLAN_LABELS, planAtLeast, upgradeHrefFor, type PlanTier } from "@/lib/plans/entitlements";

interface Wall {
  minPlan: PlanTier;
  featureLabel?: string;
}

interface PosModeUpgradeGateValue {
  currentPlan: PlanTier;
  wall: Wall | null;
  dismiss: () => void;
  /**
   * Gate an in-POS action: true when the current plan already covers
   * `minPlan`; otherwise surfaces the dismissible banner (rendered by
   * PosModeUpgradeBanner, wherever the shell places it) and returns false.
   * Mirrors useUpgradeGate's requireFeature (src/features/billing/upgrade/
   * upgrade-modal.tsx) but with banner presentation, not a blocking modal —
   * a cashier mid-transaction shouldn't be stopped cold by a dialog. Back
   * Office's modal path is untouched; this is scoped to POS Mode only.
   */
  requireFeature: (minPlan: PlanTier, featureLabel?: string) => boolean;
}

const PosModeUpgradeContext = createContext<PosModeUpgradeGateValue | null>(null);

export function usePosModeUpgradeGate(): PosModeUpgradeGateValue {
  const ctx = useContext(PosModeUpgradeContext);
  if (!ctx) {
    throw new Error("usePosModeUpgradeGate must be used within PosModeUpgradeProvider");
  }
  return ctx;
}

export function PosModeUpgradeProvider({ children }: { children: React.ReactNode }) {
  const { data: subData } = useSubscriptionStatus();
  const currentPlan: PlanTier = (subData?.subscription?.plan as PlanTier) ?? "FREE";
  const [wall, setWall] = useState<Wall | null>(null);

  const dismiss = useCallback(() => setWall(null), []);

  const requireFeature = useCallback(
    (minPlan: PlanTier, featureLabel?: string) => {
      if (planAtLeast(currentPlan, minPlan)) {
        setWall(null);
        return true;
      }
      setWall({ minPlan, featureLabel });
      return false;
    },
    [currentPlan]
  );

  const value = useMemo(
    () => ({ currentPlan, wall, dismiss, requireFeature }),
    [currentPlan, wall, dismiss, requireFeature]
  );

  return <PosModeUpgradeContext.Provider value={value}>{children}</PosModeUpgradeContext.Provider>;
}

/** Renders nothing when no wall is active — placed explicitly by PosModeShell
 * (below the status bar) rather than auto-injected by the provider, so its
 * position in the shell is a deliberate layout choice, not implicit. */
export function PosModeUpgradeBanner() {
  const { t } = useI18n();
  const { wall, dismiss } = usePosModeUpgradeGate();

  if (!wall) return null;

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-900 dark:text-amber-200">
      <span className="flex min-w-0 items-center gap-2">
        <Sparkles className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{wall.featureLabel || t("billing.upgradeGate.defaultBody")}</span>
      </span>
      {/* Every tap target here is h-11 (44px) — the spec's own floor for
          POS Mode, banner included. */}
      <span className="flex shrink-0 items-center gap-1">
        <Button asChild size="sm" variant="outline" className="h-11">
          <Link href={upgradeHrefFor(wall.minPlan)}>
            {t("billing.upgradeGate.upgradeTo")} {PLAN_LABELS[wall.minPlan]}
          </Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11"
          aria-label={t("common.actions.close")}
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </span>
    </div>
  );
}
