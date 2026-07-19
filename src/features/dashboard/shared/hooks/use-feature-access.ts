"use client";

import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { hasSupplierManagementAccess, hasAdvancedReportsAccess } from "@/config/stripe.config";

/**
 * Hook to check if user has access to specific features
 */
export function useFeatureAccess() {
  const { data: subscriptionStatus } = useSubscriptionStatus();

  const subscription = subscriptionStatus?.subscription;
  const plan = subscription?.plan;

  const supplierManagementAccess =
    plan && subscription?.status === "ACTIVE" ? hasSupplierManagementAccess(plan) : false;

  const advancedReportsAccess =
    plan && subscription?.status === "ACTIVE" ? hasAdvancedReportsAccess(plan) : false;

  return {
    supplierManagementAccess,
    advancedReportsAccess,
    isLoading: !subscriptionStatus,
    plan,
    isActive: subscription?.status === "ACTIVE",
  };
}
