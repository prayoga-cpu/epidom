"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { PLAN_LABELS, upgradeHrefFor, type PlanTier } from "@/lib/plans/entitlements";

interface SubscriptionLockedStateProps {
  title?: string;
  message?: string;
  className?: string;
  showIcon?: boolean;
  /**
   * Tier that unlocks the feature. When set, the CTA routes to the right pricing
   * URL (POS → trial promo) and reads "Upgrade to {plan}". Defaults to the legacy
   * "Upgrade to Pro" → /pricing#plans behaviour when omitted.
   */
  requiredPlan?: PlanTier;
}

/**
 * SubscriptionLockedState Component
 *
 * Reusable component for displaying subscription-locked features.
 * Provides consistent UI and behavior across all locked features.
 * Follows DRY principle by centralizing the subscription-locked pattern.
 */
export function SubscriptionLockedState({
  title,
  message,
  className,
  showIcon = true,
  requiredPlan,
}: SubscriptionLockedStateProps) {
  const { t } = useI18n();
  const router = useRouter();

  const displayTitle = title || t("data.suppliers.locked");
  const displayMessage = message || t("data.suppliers.locked");
  const ctaLabel = requiredPlan
    ? `${t("billing.upgradeGate.upgradeTo")} ${PLAN_LABELS[requiredPlan]}`
    : t("billing.upgradeToPro");
  const ctaHref = requiredPlan ? upgradeHrefFor(requiredPlan) : "/pricing#plans";

  return (
    <Card className={className}>
      <CardContent className="flex min-h-[400px] flex-col items-center justify-center py-12 text-center">
        {showIcon && (
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <AlertCircle className="text-primary h-6 w-6" />
          </div>
        )}
        <h3 className="mb-2 text-lg font-semibold">{displayTitle}</h3>
        {message && <p className="text-muted-foreground mb-4 text-sm">{displayMessage}</p>}
        <Button
          onClick={() => router.push(ctaHref)}
          className="mt-4 bg-[var(--color-brand-primary)] hover:opacity-90"
          size="sm"
        >
          {ctaLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
