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
    case "INCOMPLETE":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
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
    case "INCOMPLETE":
      return "profile.subscription.status.incomplete";
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
 * Plan prices per currency. Primary market is Indonesia (IDR).
 * USD and EUR are shown for international users.
 */
const PLAN_PRICES: Record<string, Record<string, string>> = {
  POS: {
    IDR: "Rp 99.000/bln",
    USD: "$6/month",
    EUR: "€19/month",
  },
  OPERATIONS: {
    IDR: "Rp 249.000/bln",
    USD: "$15/month",
    EUR: "€49/month",
  },
  ENTERPRISE: {
    IDR: "Sesuai Permintaan",
    USD: "Custom",
    EUR: "Custom",
  },
  FREE: {
    IDR: "Gratis / selamanya",
    USD: "Free / forever",
    EUR: "Gratuit / à vie",
  },
};

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
 * Get plan details, with price localised to the user's active currency.
 * Pass currency from useCurrency() so the price updates when the user
 * changes their currency setting without a page reload.
 */
export function getPlanDetails(
  plan: string | undefined,
  t: (key: string) => string,
  currency: string = "IDR"
): PlanDetails {
  const curr = currency === "IDR" || currency === "USD" || currency === "EUR" ? currency : "IDR";

  switch (plan) {
    case "OPERATIONS":
      return {
        name: t("profile.subscription.plans.pro") || "Operations",
        price: PLAN_PRICES.OPERATIONS[curr],
        color: "text-purple-600",
        badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      };
    case "ENTERPRISE":
      return {
        name: t("profile.subscription.plans.enterprise") || "Enterprise",
        price: PLAN_PRICES.ENTERPRISE[curr],
        color: "text-blue-600",
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      };
    case "FREE":
      return {
        name: t("profile.subscription.plans.free") || "Starter Plan",
        price: t("profile.subscription.plans.free_price") || PLAN_PRICES.FREE[curr],
        color: "text-emerald-600",
        badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
      };
    case "POS":
      return {
        name: t("profile.subscription.plans.pos") || "POS",
        price: PLAN_PRICES.POS[curr],
        color: "text-green-600",
        badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      };
    default:
      return {
        name: plan || "Unknown Plan",
        price: "-",
        color: "text-gray-600",
        badgeColor: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
      };
  }
}

/**
 * Get plan badge color classes
 */
export function getPlanBadgeColor(plan?: string): string {
  switch (plan) {
    case "OPERATIONS":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "ENTERPRISE":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "FREE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "POS":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Get plan label (requires i18n function)
 */
export function getPlanLabel(plan: string | undefined, t: (key: string) => string): string {
  switch (plan) {
    case "OPERATIONS":
      return t("profile.subscription.plans.pro") || plan || "";
    case "ENTERPRISE":
      return t("profile.subscription.plans.enterprise") || plan || "";
    case "FREE":
      return t("profile.subscription.plans.free") || "Starter Plan";
    case "POS":
      return t("profile.subscription.plans.pos") || "POS";
    default:
      return plan || "";
  }
}

