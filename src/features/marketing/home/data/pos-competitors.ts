import type { Locale } from "@/components/lang/i18n-provider";
import type { PriceCurrency } from "@/lib/constants/plan-pricing";

/**
 * What another till costs, for the home calculator's "Your current POS" picker.
 *
 * Every figure is copied from the matching comparison page under
 * src/features/marketing/compare/data/ (which carries the source and the date
 * it was checked), never typed in fresh: pos-competitors.test.ts fails when an
 * amount here no longer appears on that page. A system whose page states no
 * price is `quote`, and the visitor types what they pay. Sunday (a payment
 * layer) and Klikit (an order aggregator) are not tills, so they are left out.
 *
 * No exchange rates: each price stays in the currency it is published in, and
 * picking a system priced in another currency switches the calculator to it.
 */
export type CompetitorPrice =
  /** A subscription per month. */
  | { kind: "monthly"; amount: number }
  /** Billed per year; the calculator shows the monthly share. */
  | { kind: "yearly"; amount: number }
  /** No subscription; a percentage of each card payment instead. */
  | { kind: "cardFee"; percent: number }
  /** No public price on its comparison page. */
  | { kind: "quote" };

export interface PosCompetitor {
  /** Unique per entry (one entry per published plan). */
  id: string;
  name: string;
  /** The published plan the price is for, when it names one. */
  plan?: string;
  /** Currency the price is published in; null for `quote`. */
  currency: PriceCurrency | null;
  price: CompetitorPrice;
  /** Its comparison page: /compare/{slug}, written in these languages. */
  compareSlug: string;
  compareLocales: readonly Locale[];
}

const FR_EN = ["fr", "en"] as const;
const ID_EN = ["id", "en"] as const;

export const POS_COMPETITORS: readonly PosCompetitor[] = [
  // Priced in euros (French market).
  {
    id: "innovorder-starter",
    name: "Innovorder",
    plan: "Starter",
    currency: "EUR",
    price: { kind: "monthly", amount: 79 },
    compareSlug: "innovorder",
    compareLocales: FR_EN,
  },
  {
    id: "zettle",
    name: "Zettle",
    currency: "EUR",
    price: { kind: "cardFee", percent: 1.75 },
    compareSlug: "zettle",
    compareLocales: FR_EN,
  },
  // Priced in rupiah (Indonesian market).
  {
    id: "moka-premium",
    name: "Moka",
    plan: "Premium",
    currency: "IDR",
    price: { kind: "monthly", amount: 299_000 },
    compareSlug: "moka",
    compareLocales: ID_EN,
  },
  {
    id: "pawoon-pro",
    name: "Pawoon",
    plan: "Pro",
    currency: "IDR",
    price: { kind: "monthly", amount: 299_000 },
    compareSlug: "pawoon",
    compareLocales: ID_EN,
  },
  {
    id: "esb-advanced",
    name: "ESB",
    plan: "Advanced",
    currency: "IDR",
    price: { kind: "monthly", amount: 499_000 },
    compareSlug: "esb",
    compareLocales: ID_EN,
  },
  {
    id: "qasir-pro",
    name: "Qasir",
    plan: "Pro",
    currency: "IDR",
    price: { kind: "yearly", amount: 699_000 },
    compareSlug: "qasir",
    compareLocales: ID_EN,
  },
  {
    id: "kasir-pintar-pro",
    name: "Kasir Pintar",
    plan: "Pro",
    currency: "IDR",
    price: { kind: "yearly", amount: 666_000 },
    compareSlug: "kasir-pintar",
    compareLocales: ID_EN,
  },
  {
    id: "olsera-basic",
    name: "Olsera",
    plan: "Basic",
    currency: "IDR",
    price: { kind: "yearly", amount: 1_288_000 },
    compareSlug: "olsera",
    compareLocales: ID_EN,
  },
  {
    id: "olsera-premium",
    name: "Olsera",
    plan: "Premium",
    currency: "IDR",
    price: { kind: "yearly", amount: 1_988_000 },
    compareSlug: "olsera",
    compareLocales: ID_EN,
  },
  {
    id: "olsera-pro",
    name: "Olsera",
    plan: "Pro",
    currency: "IDR",
    price: { kind: "yearly", amount: 2_688_000 },
    compareSlug: "olsera",
    compareLocales: ID_EN,
  },
  // No public price on their comparison page.
  ...(
    [
      ["zelty", "Zelty", FR_EN],
      ["sumup-pos-pro", "SumUp POS Pro", FR_EN],
      ["laddition", "L'Addition", FR_EN],
      ["lightspeed", "Lightspeed", FR_EN],
      ["popina", "Popina", FR_EN],
      ["majoo", "Majoo", ID_EN],
    ] as const
  ).map(
    ([slug, name, locales]): PosCompetitor => ({
      id: slug,
      name,
      currency: null,
      price: { kind: "quote" },
      compareSlug: slug,
      compareLocales: locales,
    })
  ),
];

/** What the till costs per month, in its own currency; null when there is no public price. */
export function monthlyPosFee(competitor: PosCompetitor): number | null {
  switch (competitor.price.kind) {
    case "monthly":
      return competitor.price.amount;
    case "yearly":
      // Whole units: every yearly price here is in rupiah.
      return Math.round(competitor.price.amount / 12);
    case "cardFee":
      return 0;
    case "quote":
      return null;
  }
}

/** "Moka Premium", "Zettle". */
export function competitorLabel(competitor: PosCompetitor): string {
  return competitor.plan ? `${competitor.name} ${competitor.plan}` : competitor.name;
}

/** The comparison page in the visitor's language when it is written in it, else in English. */
export function compareLocaleFor(competitor: PosCompetitor, locale: Locale): Locale {
  return competitor.compareLocales.includes(locale) ? locale : "en";
}
