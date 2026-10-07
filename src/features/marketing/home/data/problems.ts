import type { SourceId } from "./sources";

/**
 * The "Which problem costs you the most?" picker. Text lives in
 * `redesign.landing.picker.pains.<id>` (chip, pain, number, before, after,
 * fix1..fix3, cta, and numberNote where the pain has one); this file holds what is not text: the source of each
 * figure, which plan each fix needs, and where the button goes.
 *
 * Plans follow the code's gates (FEATURE_MIN_PLAN and the Back Office page
 * layouts): online ordering, the till, KDS and table QR are POS; recipes,
 * stock, finance, staff and the schedule are Operations.
 */

export type PainId = "commissions" | "margin" | "stock" | "outages" | "queues" | "staff" | "apps";

export type BadgePlan = "FREE" | "POS" | "OPERATIONS";

/** calculator: scroll to #calculator (commissions also presets the rate). */
export type PainCta = "calculator" | "trial" | "stockGuide" | "free";

export interface Pain {
  id: PainId;
  /** The figure's source; null when the pain is told in words only. */
  numberSource: SourceId | null;
  /** The figure needs a qualifier next to it ("US data", "industry estimate"): `numberNote`. */
  numberNote?: boolean;
  /** Which of fix1..fix3 carries a figure, and its source. */
  fixSources?: Partial<Record<1 | 2 | 3, SourceId>>;
  plans: readonly BadgePlan[];
  cta: PainCta;
}

export const PAINS: readonly Pain[] = [
  {
    id: "commissions",
    numberSource: "S1",
    fixSources: { 3: "S2" },
    plans: ["POS"],
    cta: "calculator",
  },
  { id: "margin", numberSource: "S3", plans: ["OPERATIONS"], cta: "calculator" },
  { id: "stock", numberSource: "S3", plans: ["OPERATIONS"], cta: "stockGuide" },
  { id: "outages", numberSource: "S4", numberNote: true, plans: ["POS"], cta: "trial" },
  { id: "queues", numberSource: "S5", numberNote: true, plans: ["POS"], cta: "trial" },
  { id: "staff", numberSource: "S6", plans: ["POS", "OPERATIONS"], cta: "trial" },
  { id: "apps", numberSource: null, plans: ["FREE"], cta: "free" },
];

/** Selected on load, so the result panel is never empty. */
export const DEFAULT_PAIN: PainId = "commissions";

/** The commission rate (in %) the commissions button hands to the calculator: S1. */
export const PLATFORM_COMMISSION_PERCENT = 30;

/** The stock guide in the docs, per site language. */
export const STOCK_GUIDE_SLUG = {
  fr: "stock-et-commandes-fournisseurs",
  en: "stock-and-supplier-orders",
  id: "stok-dan-pesanan-pemasok",
} as const;
