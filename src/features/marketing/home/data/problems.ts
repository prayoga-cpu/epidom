/**
 * The "Which problem costs you the most?" picker. Text lives in
 * `redesign.landing.picker.pains.<id>` (chip, pain, number, before, after,
 * fix1..fix3, cta, and numberNote where the pain has one); this file holds
 * what is not text: whether the pain shows a figure, which plan each fix
 * needs, and where the button goes.
 *
 * Plans follow the code's gates (FEATURE_MIN_PLAN and the Back Office page
 * layouts): online ordering, the till, KDS and table QR are POS; recipes,
 * stock, finance, staff and the schedule are Operations.
 */

export type PainId = "commissions" | "margin" | "stock" | "outages" | "queues" | "staff" | "apps";

export type BadgePlan = "FREE" | "POS" | "OPERATIONS";

/** calculator: the home page's #calculator (commissions also presets the rate, via ?commission=). */
export type PainCta = "calculator" | "trial" | "stockGuide" | "free";

export interface Pain {
  id: PainId;
  /** The pain shows its figure (`number`); false when it is told in words only. */
  hasNumber: boolean;
  /** The figure needs a qualifier next to it ("US data", "industry estimate"): `numberNote`. */
  numberNote?: boolean;
  plans: readonly BadgePlan[];
  cta: PainCta;
}

export const PAINS: readonly Pain[] = [
  { id: "commissions", hasNumber: true, plans: ["POS"], cta: "calculator" },
  { id: "margin", hasNumber: true, plans: ["OPERATIONS"], cta: "calculator" },
  { id: "stock", hasNumber: true, plans: ["OPERATIONS"], cta: "stockGuide" },
  { id: "outages", hasNumber: true, numberNote: true, plans: ["POS"], cta: "trial" },
  { id: "queues", hasNumber: true, numberNote: true, plans: ["POS"], cta: "trial" },
  { id: "staff", hasNumber: true, plans: ["POS", "OPERATIONS"], cta: "trial" },
  { id: "apps", hasNumber: false, plans: ["FREE"], cta: "free" },
];

/** Selected on load, so the result panel is never empty. */
export const DEFAULT_PAIN: PainId = "commissions";

/**
 * The commission rate (in %) the commissions button hands to the calculator:
 * Uber Eats' default plan in France, before tax (commandeici.com, June 2026).
 */
export const PLATFORM_COMMISSION_PERCENT = 30;

/** The stock guide in the docs, per site language. */
export const STOCK_GUIDE_SLUG = {
  fr: "stock-et-commandes-fournisseurs",
  en: "stock-and-supplier-orders",
  id: "stok-dan-pesanan-pemasok",
} as const;
