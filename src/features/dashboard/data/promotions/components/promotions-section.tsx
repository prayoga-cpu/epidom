"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { SubscriptionLockedState } from "@/features/dashboard/shared/components/subscription-locked-state";
import { FEATURE_MIN_PLAN } from "@/lib/plans/entitlements";
// Imported by file, not from the `../../components` barrel, which also drags in the
// category-management dialog and other Data-page weight this tab never renders.
import { SectionLoadingState } from "../../components/section-loading-state";
import { useCoupons } from "../hooks/use-coupons";
import { useDiscountPresets } from "../hooks/use-discount-presets";
import { useLoyaltySettings } from "../hooks/use-loyalty-settings";
import { usePromotionsAccess } from "../hooks/use-promotions-access";
import { isFeatureLockedError } from "../lib/promotion-utils";
import { CouponsCard } from "./coupons-card";
import { DiscountPresetsCard } from "./discount-presets-card";
import { LoyaltyCard } from "./loyalty-card";

interface PromotionsSectionProps {
  storeId: string;
}

/** Same outer-card footprint as the other Data tabs, so switching tabs doesn't jump. */
const OUTER_CARD_CLASS = "min-h-[calc((100vh-150px)/var(--app-zoom,1))] overflow-hidden shadow-md";

/**
 * The Data page's Promotions tab: discount presets, coupons and loyalty points.
 *
 * Below the OPERATIONS plan it renders the upgrade prompt INSTEAD of the forms
 * and never mounts the content component, so nothing is fetched (the routes
 * would only answer 403).
 */
export function PromotionsSection({ storeId }: PromotionsSectionProps) {
  const { t } = useI18n();
  const { isLoading, hasAccess } = usePromotionsAccess();

  if (isLoading) return <SectionLoadingState title={t("promotions.pageTitle")} />;
  if (!hasAccess) return <PromotionsLocked />;
  return <PromotionsContent storeId={storeId} />;
}

function PromotionsLocked() {
  const { t } = useI18n();
  return (
    <Card className={OUTER_CARD_CLASS}>
      <CardHeader className="border-b">
        <CardTitle className="text-lg font-bold">{t("promotions.pageTitle")}</CardTitle>
      </CardHeader>
      <SubscriptionLockedState
        title={t("promotions.locked.title")}
        message={t("promotions.locked.description")}
        requiredPlan={FEATURE_MIN_PLAN.loyaltyAndPromotions}
      />
    </Card>
  );
}

function PromotionsContent({ storeId }: PromotionsSectionProps) {
  const { t } = useI18n();
  const presets = useDiscountPresets(storeId);
  const coupons = useCoupons(storeId);
  const loyalty = useLoyaltySettings(storeId);

  // The client-side plan check can be stale or wrong (a downgrade, a plan the
  // status call didn't know about); the server is what enforces the tier, and any
  // of its three routes saying "locked" means the same upgrade screen.
  if ([presets, coupons, loyalty].some((query) => isFeatureLockedError(query.error))) {
    return <PromotionsLocked />;
  }

  return (
    <Card className={OUTER_CARD_CLASS}>
      <CardHeader className="border-b">
        <CardTitle className="text-lg font-bold">{t("promotions.pageTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("promotions.pageDescription")}</p>
      </CardHeader>
      {/* Each block loads and fails on its own, so one broken route doesn't blank the page. */}
      <CardContent className="space-y-6 pb-6">
        <DiscountPresetsCard storeId={storeId} query={presets} />
        <CouponsCard storeId={storeId} query={coupons} />
        <LoyaltyCard storeId={storeId} query={loyalty} />
      </CardContent>
    </Card>
  );
}
