import type { Locale } from "@/components/lang/i18n-provider";

/**
 * The "How do you want to start?" modal: four questions, then one
 * recommendation. Pure so the rules can be tested without rendering.
 *
 * The plan follows what the code gates, not what would read best:
 *  - online ordering is POS (FEATURE_MIN_PLAN.onlineOrders), so "keep my till,
 *    add online ordering" is POS, not Free;
 *  - POS allows one store and Operations three (PLAN_MAX_STORES), so 2-3
 *    outlets means Operations and 4+ means an Enterprise conversation;
 *  - recipes, stock, suppliers and finance are Operations.
 */

/** Where the business is: the two markets Epidom sells in, or anywhere else. */
export type Market = "fr" | "id" | "global";

export type CurrentPos =
  | "zelty"
  | "laddition"
  | "lightspeed"
  | "sumup"
  | "tiller"
  | "moka"
  | "majoo"
  | "pawoon"
  | "esb"
  | "qasir"
  | "square"
  | "toast"
  | "clover"
  | "other"
  | "none";

/** A: keep the till, add online ordering. B: keep the till, track margin. C: switch fully. */
export type MigrationPath = "A" | "B" | "C";

export type Outlets = "1" | "2-3" | "4+";

export type RecommendedPlan = "POS" | "OPERATIONS" | "ENTERPRISE";

const MARKETS: readonly Market[] = ["fr", "id", "global"];

/** The markets to pick from, the one matching the site language first. */
export function marketOptions(locale: Locale): Market[] {
  return [...MARKETS].sort((a, b) => Number(b === locale) - Number(a === locale));
}

/** Tills the visitor is likely to be leaving, by where the business is. */
export const CURRENT_POS_OPTIONS: Record<Market, readonly CurrentPos[]> = {
  fr: ["zelty", "laddition", "lightspeed", "sumup", "tiller", "other", "none"],
  id: ["moka", "majoo", "pawoon", "esb", "qasir", "other", "none"],
  global: ["square", "toast", "lightspeed", "clover", "sumup", "other", "none"],
};

export const OUTLET_OPTIONS: readonly Outlets[] = ["1", "2-3", "4+"];

/**
 * French cash-register software has to be NF525-certified or attested, and
 * Epidom has neither yet. Until the founder settles that, the "switch fully"
 * path is not offered to a business in France, whatever language it reads the
 * site in. Flip to true once it is settled.
 */
export const NF525_SETTLED = false;

export function availablePaths(market: Market): MigrationPath[] {
  return market === "fr" && !NF525_SETTLED ? ["A", "B"] : ["A", "B", "C"];
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
