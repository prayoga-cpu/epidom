import type { Locale } from "@/components/lang/i18n-provider";
import {
  LOCALE_PRICE_CURRENCY,
  PLAN_PRICING,
  type PaidPlan,
  type PriceCurrency,
} from "@/lib/constants/plan-pricing";

const PAID_PLANS = Object.keys(PLAN_PRICING) as PaidPlan[];
const PRICE_CURRENCIES = Object.keys(PLAN_PRICING.POS) as PriceCurrency[];

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return PAID_PLANS.includes(plan as PaidPlan);
}

/**
 * The currency the billing page quotes plan prices in. Every Stripe Price
 * carries exact EUR, USD and IDR amounts (docs/BILLING.md), so a store that
 * trades in one of those sees the amount Stripe will actually charge, not a
 * live-rate conversion of the IDR price. Any other store currency falls back
 * to the currency the site quotes for the UI language, as /pricing does.
 */
export function resolvePriceCurrency(
  storeCurrency: string | null | undefined,
  locale: Locale
): PriceCurrency {
  return PRICE_CURRENCIES.includes(storeCurrency as PriceCurrency)
    ? (storeCurrency as PriceCurrency)
    : LOCALE_PRICE_CURRENCY[locale];
}

/**
 * The yearly discount, in whole percent, that holds for every paid plan in
 * `currency` (the smallest one, rounded down), so "Save N%" is never an
 * overstatement for any card it sits above.
 */
export function yearlySavingsPercent(currency: PriceCurrency): number {
  return Math.min(
    ...PAID_PLANS.map((plan) => {
      const { monthly, yearly } = PLAN_PRICING[plan][currency];
      return Math.floor((1 - yearly / monthly) * 100);
    })
  );
}
