/**
 * Subscription Helper Utilities
 *
 * Shared utilities for subscription-related display logic.
 * Follows DRY principle to avoid code duplication across components.
 */

import type { SubscriptionStatus } from "@prisma/client";

/**
 * Get status badge color classes
 */
export function getStatusColor(status?: string | SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "CANCELED":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "PAST_DUE":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

/**
 * Get status label (requires i18n function)
 * Returns status string that should be translated using i18n
 */
export function getStatusLabelKey(status?: string | SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "profile.subscription.status.active";
    case "CANCELED":
      return "profile.subscription.status.canceled";
    case "PAST_DUE":
      return "profile.subscription.status.pastDue";
    default:
      return "";
  }
}

/**
 * Get status label with translation
 */
export function getStatusLabel(
  status: string | SubscriptionStatus | undefined,
  t: (key: string) => string
): string {
  const key = getStatusLabelKey(status);
  if (!key) return status || "";
  return t(key) || status || "";
}

/**
 * Plan details type
 */
export interface PlanDetails {
  name: string;
  price: string;
  color: string;
  badgeColor: string;
}

/**
 * Get plan details
 */
export function getPlanDetails(
  plan: string | undefined,
  t: (key: string) => string
): PlanDetails {
  switch (plan) {
    case "PRO":
      return {
        name: t("profile.subscription.plans.pro") || "Pro",
        price: t("profile.subscription.pricing.pro") || "€79/month",
        color: "text-purple-600",
        badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      };
    case "ENTERPRISE":
      return {
        name: t("profile.subscription.plans.enterprise") || "Enterprise",
        price: t("profile.subscription.pricing.enterprise") || "Custom",
        color: "text-blue-600",
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      };
    default:
      return {
        name: t("profile.subscription.plans.starter") || "Starter",
        price: t("profile.subscription.pricing.starter") || "€29/month",
        color: "text-green-600",
        badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      };
  }
}

/**
 * Get plan badge color classes
 */
export function getPlanBadgeColor(plan?: string): string {
  switch (plan) {
    case "PRO":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "ENTERPRISE":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    default:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  }
}

/**
 * Get plan label (requires i18n function)
 */
export function getPlanLabel(plan: string | undefined, t: (key: string) => string): string {
  switch (plan) {
    case "PRO":
      return t("profile.subscription.plans.pro") || plan || "";
    case "ENTERPRISE":
      return t("profile.subscription.plans.enterprise") || plan || "";
    default:
      return t("profile.subscription.plans.starter") || plan || "";
  }
}

