/**
 * Central plan entitlements — the single source of truth for the plan hierarchy
 * and feature gating.
 *
 * Client-safe: uses a local string-union `PlanTier` (structurally identical to
 * Prisma's `SubscriptionPlan`) so this module can be imported from both server
 * routes and client components without pulling `@prisma/client` into the bundle.
 */

export type PlanTier = "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";

/** Plan hierarchy, lowest → highest. */
export const PLAN_ORDER: PlanTier[] = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"];

export function planRank(plan: PlanTier): number {
  return PLAN_ORDER.indexOf(plan);
}

/** True when `plan` is at least `min` in the hierarchy. */
export function planAtLeast(plan: PlanTier, min: PlanTier): boolean {
  return planRank(plan) >= planRank(min);
}

/** Human-facing plan names used in upgrade prompts and the sidebar. */
export const PLAN_LABELS: Record<PlanTier, string> = {
  FREE: "Free",
  POS: "POS",
  OPERATIONS: "Operations",
  ENTERPRISE: "Enterprise",
};

/**
 * Feature → minimum plan required. The one place that decides what each tier
 * unlocks. Add new gated features here rather than scattering plan checks.
 */
export const FEATURE_MIN_PLAN = {
  posAccess: "POS",
  onlineOrders: "POS",
  tableReservations: "POS",
  productManagement: "POS",
  supplierManagement: "OPERATIONS",
  advancedReports: "OPERATIONS",
  multiStore: "OPERATIONS",
  finance: "ENTERPRISE",
} satisfies Record<string, PlanTier>;

export type PlanFeature = keyof typeof FEATURE_MIN_PLAN;

export function minPlanFor(feature: PlanFeature): PlanTier {
  return FEATURE_MIN_PLAN[feature];
}

export function planHasFeature(plan: PlanTier, feature: PlanFeature): boolean {
  return planAtLeast(plan, FEATURE_MIN_PLAN[feature]);
}

/**
 * Pricing URL for upgrading to `minPlan`. POS upgrades route through the 14-day
 * free-trial promo (`?trial=true` auto-opens the POS trial confirm on /pricing);
 * higher tiers use the generic upgrade redirect. Used by both the server-side
 * `requirePlan` gate and the client upgrade modal so they stay consistent.
 */
export function upgradeHrefFor(minPlan: PlanTier): string {
  return minPlan === "POS"
    ? "/pricing?trial=true#plans"
    : `/pricing?upgrade=true&required=${minPlan}#plans`;
}
