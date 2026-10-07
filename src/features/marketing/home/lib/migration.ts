import type { Locale } from "@/components/lang/i18n-provider";

/**
 * The "How do you want to start?" modal: three questions, then one
 * recommendation. Pure so the rules can be tested without rendering.
 *
 * The plan follows what the code gates, not what would read best:
 *  - online ordering is POS (FEATURE_MIN_PLAN.onlineOrders), so "keep my till,
 *    add online ordering" is POS, not Free;
 *  - POS allows one store and Operations three (PLAN_MAX_STORES), so 2-3
 *    outlets means Operations and 4+ means an Enterprise conversation;
 *  - recipes, stock, suppliers and finance are Operations.
 */

export type CurrentPos =
  | "zelty"
  | "lightspeed"
  | "sumup"
  | "tiller"
  | "moka"
  | "majoo"
  | "other"
  | "none";

/** A: keep the till, add online ordering. B: keep the till, track margin. C: switch fully. */
export type MigrationPath = "A" | "B" | "C";

export type Outlets = "1" | "2-3" | "4+";

export type RecommendedPlan = "POS" | "OPERATIONS" | "ENTERPRISE";

/** Tills the visitor is likely to be leaving, by site language. */
export const CURRENT_POS_OPTIONS: Record<Locale, readonly CurrentPos[]> = {
  fr: ["zelty", "lightspeed", "sumup", "tiller", "other", "none"],
  en: ["zelty", "lightspeed", "sumup", "tiller", "other", "none"],
  id: ["moka", "majoo", "other", "none"],
};

export const OUTLET_OPTIONS: readonly Outlets[] = ["1", "2-3", "4+"];

/**
 * French cash-register software has to be NF525-certified or attested, and
 * Epidom has neither yet. Until the founder settles that, the "switch fully"
 * path is not offered on the French site. Flip to true once it is settled.
 */
export const NF525_SETTLED = false;

export function availablePaths(locale: Locale): MigrationPath[] {
  return locale === "fr" && !NF525_SETTLED ? ["A", "B"] : ["A", "B", "C"];
}

export interface MigrationChoice {
  currentPos: CurrentPos;
  path: MigrationPath;
  outlets: Outlets;
}

export interface MigrationResult {
  plan: RecommendedPlan;
  /** The visitor keeps their current till (they have one and are not replacing it). */
  keepsTill: boolean;
  /** POS would fit the path, but not the number of outlets. */
  upgradedForOutlets: boolean;
  cta: "trial" | "operations" | "whatsapp";
}

export function recommend({ currentPos, path, outlets }: MigrationChoice): MigrationResult {
  const keepsTill = currentPos !== "none" && path !== "C";
  if (outlets === "4+") {
    return { plan: "ENTERPRISE", keepsTill, upgradedForOutlets: false, cta: "whatsapp" };
  }
  if (path === "B") {
    return { plan: "OPERATIONS", keepsTill, upgradedForOutlets: false, cta: "operations" };
  }
  const plan = outlets === "1" ? "POS" : "OPERATIONS";
  return {
    plan,
    keepsTill,
    upgradedForOutlets: plan === "OPERATIONS",
    cta: plan === "POS" ? "trial" : "operations",
  };
}
