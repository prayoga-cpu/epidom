import type { Locale } from "@/components/lang/i18n-provider";
import { resolvePriceCurrency } from "@/features/dashboard/billing/lib/plan-price";
import { INTL_LOCALES } from "@/components/lang/i18n-provider";
import { PLAN_PRICING, type PriceCurrency } from "@/lib/constants/plan-pricing";
import type { OnboardingBilling } from "@/lib/onboarding/contracts";
import { examplePrices, isBusinessType, type BusinessType } from "@/lib/onboarding/markets";
import type { PlanCheckout, PlanIntent } from "./plan-intent";

/**
 * The setup flow, one screen at a time. The first screen is the plan (with the
 * optional partner referral code under the cards); then the store's name, its
 * kind of place, and the draft: everything we set up from those answers on one
 * screen whose button publishes. An account that can't take a self-serve plan
 * (already paying, a quoted price pending, or setting up another store) has no
 * plan screen.
 */
export type FlowStep = "plan" | "name" | "type" | "draft";

export function flowSteps(showPlan: boolean): FlowStep[] {
  return [...(showPlan ? (["plan"] as const) : []), "name", "type", "draft"];
}

/** What the owner picked on the plan screen. Free is only ever reached by skipping setup. */
export type PlanChoice =
  | "trial"
  | "trialYearly"
  | "monthly"
  | "yearly"
  | "operations"
  | "operationsYearly";

/**
 * The plan choices on offer: the 14-day POS trial first when it still
 * applies, then POS monthly and yearly, then Operations monthly and yearly.
 */
export function availablePlanChoices(billing: OnboardingBilling): PlanChoice[] {
  return [
    ...(billing.posTrialEligible ? (["trial"] as const) : []),
    "monthly",
    "yearly",
    "operations",
    "operationsYearly",
  ];
}

/** The choice that starts selected: the plan the owner came for, else the trial, else monthly. */
export function defaultPlanChoice(
  billing: OnboardingBilling,
  intent: PlanIntent | null
): PlanChoice {
  if (intent?.plan === "OPERATIONS") return intent.yearly ? "operationsYearly" : "operations";
  // Yearly POS from the pricing page is paid; the home page's trial buttons carry monthly.
  if (intent?.plan === "POS" && intent.yearly) return "yearly";
  return billing.posTrialEligible ? "trial" : "monthly";
}

/** The Checkout that publishing goes on to for a choice (null: stay on Free). */
export function checkoutForChoice(
  choice: PlanChoice,
  billing: OnboardingBilling
): PlanCheckout | null {
  if (!billing.canCheckout) return null;
  switch (choice) {
    case "trial":
      return billing.posTrialEligible ? { plan: "POS", yearly: false, trial: true } : null;
    case "trialYearly":
      return billing.posTrialEligible ? { plan: "POS", yearly: true, trial: true } : null;
    case "monthly":
      return { plan: "POS", yearly: false, trial: false };
    case "yearly":
      return { plan: "POS", yearly: true, trial: false };
    case "operations":
      return { plan: "OPERATIONS", yearly: false, trial: false };
    case "operationsYearly":
      return { plan: "OPERATIONS", yearly: true, trial: false };
  }
}

/** A plan choice as a line of text: "POS, 14-day free trial (no card)". */
export function planChoiceLabel(choice: PlanChoice, t: (key: string) => string): string {
  const key = {
    trial: "onboarding.flow.draft.planTrial",
    trialYearly: "onboarding.flow.draft.planTrialYearly",
    monthly: "onboarding.flow.draft.planMonthly",
    yearly: "onboarding.flow.draft.planYearly",
    operations: "onboarding.flow.plan.opsName",
    operationsYearly: "onboarding.flow.plan.opsYearlyName",
  }[choice];
  return t(key);
}

export interface PosPrices {
  currency: PriceCurrency;
  /** Per month, billed monthly: "€13.99". */
  monthly: string;
  /** Per month, billed yearly: "€11.49". */
  yearlyPerMonth: string;
  /** The whole year's invoice: "€137.88". */
  yearlyTotal: string;
  /** The first monthly / yearly invoice once a partner's % off is taken (equal to the above with 0 %). */
  monthlyAfter: string;
  yearlyTotalAfter: string;
  /** The per-month price once the % off is taken, for the crossed-out price on the cards. */
  yearlyPerMonthAfter: string;
  /** The same five for Operations. */
  opsMonthly: string;
  opsYearlyPerMonth: string;
  opsYearlyTotal: string;
  opsMonthlyAfter: string;
  opsYearlyTotalAfter: string;
  opsYearlyPerMonthAfter: string;
}

/** POS prices for the plan cards, in the currency Stripe quotes for this store. */
export function posPrices(storeCurrency: string, locale: Locale, percentOff = 0): PosPrices {
  const currency = resolvePriceCurrency(storeCurrency, locale);
  const { monthly, yearly } = PLAN_PRICING.POS[currency];
  const ops = PLAN_PRICING.OPERATIONS[currency];
  const format = new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  });
  const off = (amount: number) => Math.round(amount * (100 - percentOff)) / 100;
  return {
    currency,
    monthly: format.format(monthly),
    yearlyPerMonth: format.format(yearly),
    yearlyTotal: format.format(yearly * 12),
    monthlyAfter: format.format(off(monthly)),
    yearlyTotalAfter: format.format(off(yearly * 12)),
    yearlyPerMonthAfter: format.format(off(yearly)),
    opsMonthly: format.format(ops.monthly),
    opsYearlyPerMonth: format.format(ops.yearly),
    opsYearlyTotal: format.format(ops.yearly * 12),
    opsMonthlyAfter: format.format(off(ops.monthly)),
    opsYearlyTotalAfter: format.format(off(ops.yearly * 12)),
    opsYearlyPerMonthAfter: format.format(off(ops.yearly)),
  };
}

/** The storefront colours a new store is given one of at random (the Epidom gold, tomato, basil, ocean, berry). */
export const RANDOM_THEME_COLORS = ["#D9AE3B", "#D9480F", "#2F9E44", "#1C7ED6", "#A61E4D"] as const;

export function pickRandomThemeColor(random: () => number = Math.random): string {
  const index = Math.min(
    RANDOM_THEME_COLORS.length - 1,
    Math.floor(random() * RANDOM_THEME_COLORS.length)
  );
  return RANDOM_THEME_COLORS[index];
}

/** The three example dishes a new store starts with, named for its type of place and priced for its currency. */
export function sampleMenuItems(
  type: BusinessType | null | undefined,
  currency: string,
  translate: (key: string) => string
): { name: string; price: number }[] {
  const key: BusinessType = isBusinessType(type) ? type : "other";
  const prices = examplePrices(currency);
  return [1, 2, 3].map((n, index) => ({
    name: translate(`onboarding.flow.samples.${key}.${n}`),
    price: prices[index],
  }));
}

/** The name before the first space, for "Welcome, Sam!"; the email's local part when the account has no name. */
export function firstNameOf(name: string | null | undefined, email: string): string {
  const first = name?.trim().split(/\s+/)[0];
  if (first) return first;
  return email.split("@")[0] ?? email;
}

/** The monthly-equivalent price of a choice, "€13.99/month" (the trial shows what it costs after). */
export function planChoicePrice(choice: PlanChoice, currency: string, locale: Locale): string {
  const prices = posPrices(currency, locale);
  const perMonth =
    choice === "yearly" || choice === "trialYearly"
      ? prices.yearlyPerMonth
      : choice === "operations"
        ? prices.opsMonthly
        : choice === "operationsYearly"
          ? prices.opsYearlyPerMonth
          : prices.monthly;
  return `${perMonth}/${PER_MONTH[locale]}`;
}

const PER_MONTH: Record<Locale, string> = { en: "month", fr: "mois", id: "bulan" };
