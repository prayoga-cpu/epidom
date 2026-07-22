"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { PLAN_LABELS, planAtLeast, upgradeHrefFor, type PlanTier } from "@/lib/plans/entitlements";

interface UpgradeGateValue {
  /** Current plan (FREE when unknown / signed out). */
  currentPlan: PlanTier;
  /** Open the upgrade modal for a given tier, with an optional feature sentence. */
  openUpgrade: (minPlan: PlanTier, featureLabel?: string) => void;
  /**
   * Gate an in-app action: returns true when the current plan already covers
   * `minPlan`; otherwise opens the upgrade modal and returns false.
   */
  requireFeature: (minPlan: PlanTier, featureLabel?: string) => boolean;
}

const UpgradeGateContext = createContext<UpgradeGateValue | null>(null);

export function useUpgradeGate(): UpgradeGateValue {
  const ctx = useContext(UpgradeGateContext);
  if (!ctx) {
    throw new Error("useUpgradeGate must be used within an UpgradeGateProvider");
  }
  return ctx;
}

export function UpgradeGateProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: subData } = useSubscriptionStatus();
  const currentPlan: PlanTier = (subData?.subscription?.plan as PlanTier) ?? "FREE";

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ minPlan: PlanTier; featureLabel?: string }>({
    minPlan: "POS",
  });

  const openUpgrade = useCallback((minPlan: PlanTier, featureLabel?: string) => {
    setTarget({ minPlan, featureLabel });
    setOpen(true);
  }, []);

  const requireFeature = useCallback(
    (minPlan: PlanTier, featureLabel?: string) => {
      if (planAtLeast(currentPlan, minPlan)) return true;
      openUpgrade(minPlan, featureLabel);
      return false;
    },
    [currentPlan, openUpgrade]
  );

  const value = useMemo(
    () => ({ currentPlan, openUpgrade, requireFeature }),
    [currentPlan, openUpgrade, requireFeature]
  );

  const planLabel = PLAN_LABELS[target.minPlan];
  const isPos = target.minPlan === "POS";

  const goToPricing = useCallback(() => {
    setOpen(false);
    router.push(upgradeHrefFor(target.minPlan));
  }, [router, target.minPlan]);

  return (
    <UpgradeGateContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-full">
              <Sparkles className="text-primary h-6 w-6" />
            </div>
            <DialogTitle>
              {t("billing.upgradeGate.upgradeTo")} {planLabel}
            </DialogTitle>
            <DialogDescription>
              {target.featureLabel || t("billing.upgradeGate.defaultBody")}
              {isPos ? " " + t("billing.upgradeGate.trialHint") : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="shrink-0 gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("billing.upgradeGate.notNow")}
            </Button>
            <Button onClick={goToPricing}>
              {isPos
                ? t("billing.upgradeGate.startTrial")
                : `${t("billing.upgradeGate.upgradeTo")} ${planLabel}`}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UpgradeGateContext.Provider>
  );
}
