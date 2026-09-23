import type { Locale } from "@/components/lang/i18n-provider";

/**
 * The ONE place the public price of each paid plan is written down.
 *
 * Amounts are what the marketing site quotes, per month, before tax, in major
 * units: `yearly` is the per-month equivalent of the annual plan (the /pricing
 * toggle shows it next to "billed yearly"). The billing dashboard prices in IDR
 * and converts to the user's currency at the live exchange rate, so it reads
 * PLAN_PRICE_IDR below.
 *
 * The /pricing page and the home teaser still carry each locale's price as a
 * literal string (redesign.pricingPage.t2price_mo, ...) because the locale
 * files are shipped as plain data. plan-pricing.test.ts fails when any of those
 * strings stops matching this table, so a price change is: edit here, then let
 * the test list every string that has to follow.
 *
 * Which currency each language shows (fr -> EUR, en -> USD, id -> IDR) is a
 * marketing decision, not a billing one: whatever Stripe Checkout charges is
 * set by the Stripe Price objects behind the STRIPE_PRICE_ID env vars.
 */
export type PaidPlan = "POS" | "OPERATIONS";
export type PriceCurrency = "IDR" | "EUR" | "USD";
export type BillingInterval = "monthly" | "yearly";

export const PLAN_PRICING: Record<
  PaidPlan,
  Record<PriceCurrency, Record<BillingInterval, number>>
> = {
  POS: {
    IDR: { monthly: 229_000, yearly: 189_000 },
    EUR: { monthly: 13.99, yearly: 11.49 },
    USD: { monthly: 14.99, yearly: 12.49 },
  },
  OPERATIONS: {
    IDR: { monthly: 459_000, yearly: 379_000 },
    EUR: { monthly: 27.99, yearly: 23.49 },
    USD: { monthly: 29.99, yearly: 24.99 },
  },
};

/** The currency each site language quotes prices in. */
export const LOCALE_PRICE_CURRENCY: Record<Locale, PriceCurrency> = {
  fr: "EUR",
  en: "USD",
  id: "IDR",
};

/** Monthly IDR price per plan: the base the billing dashboard converts from. */
export const PLAN_PRICE_IDR: Record<string, number> = {
  POS: PLAN_PRICING.POS.IDR.monthly,
  OPERATIONS: PLAN_PRICING.OPERATIONS.IDR.monthly,
};

/**
 * A plan price as the marketing pages display it: "$14.99", "13,99 €",
 * "Rp 229k". IDR is abbreviated to thousands ("k") when the amount is a whole
 * number of thousands, and written out with dot separators otherwise.
 */
export function formatPlanPrice(
  plan: PaidPlan,
  currency: PriceCurrency,
  interval: BillingInterval
): string {
  const amount = PLAN_PRICING[plan][currency][interval];
  switch (currency) {
    case "USD":
      return `$${amount.toFixed(2)}`;
    case "EUR":
      return `${amount.toFixed(2).replace(".", ",")} €`;
    case "IDR":
      return amount % 1000 === 0
        ? `Rp ${amount / 1000}k`
        : `Rp ${Math.round(amount)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
}
