import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { planHasFeature } from "@/lib/plans/entitlements";

/**
 * Does this store's plan include discount presets, coupons and loyalty points?
 *
 * `useFeatureAccess` has no flag for this feature, so the check is derived from
 * the same subscription status it reads, using `FEATURE_MIN_PLAN.
 * loyaltyAndPromotions` as the single source of truth for the tier. It mirrors
 * `requirePromotionsPlanApi` on the server (which delegates to
 * `storeHasPromotionsPlan`): the plan is the store OWNER's, and a subscription
 * that isn't ACTIVE counts as FREE.
 *
 * This only decides whether to FETCH and which screen to show; the routes
 * enforce the gate themselves, and a 403 SUBSCRIPTION_FEATURE_LOCKED still
 * ends in the same upgrade screen.
 */
export function usePromotionsAccess(): { isLoading: boolean; hasAccess: boolean } {
  const { data, isLoading, isError } = useSubscriptionStatus();

  if (isLoading) return { isLoading: true, hasAccess: false };

  // The status call itself failed (or never ran), so the plan is unknown. Let
  // the server decide rather than lock out a paying store on a network blip.
  if (isError || !data) return { isLoading: false, hasAccess: true };

  const subscription = data.subscription;
  const hasAccess =
    !!subscription &&
    subscription.status === "ACTIVE" &&
    planHasFeature(subscription.plan, "loyaltyAndPromotions");

  return { isLoading: false, hasAccess };
}
