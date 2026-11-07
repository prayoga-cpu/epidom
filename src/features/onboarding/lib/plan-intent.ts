import type { OnboardingBilling } from "@/lib/onboarding/contracts";

/**
 * A paid plan picked before the visitor had an account: the pricing page's
 * POS / Operations buttons and the home page's trial buttons, clicked while
 * signed out.
 *
 * It rides on the wizard's URL through sign-up:
 * /register?next=/onboarding?plan=POS&billing=monthly. The verification link
 * and the Google sign-up both land on that `next` (see
 * verification-landing.ts), and the wizard only strips its own `verified` /
 * `signup` flags, so the plan survives them and a reload.
 *
 * In the wizard publishing goes on to that plan (checkoutAfterPublish). An account that finished
 * setup long ago lands on /pricing with the plan's confirm open instead.
 */
export type IntentPlan = "POS" | "OPERATIONS";

export interface PlanIntent {
  plan: IntentPlan;
  yearly: boolean;
}

export const PLAN_PARAM = "plan";
export const BILLING_PARAM = "billing";
const YEARLY = "yearly";
const MONTHLY = "monthly";

export function parsePlanIntent(
  params: Pick<URLSearchParams, "get"> | null | undefined
): PlanIntent | null {
  const plan = params?.get(PLAN_PARAM);
  if (plan !== "POS" && plan !== "OPERATIONS") return null;
  return { plan, yearly: params?.get(BILLING_PARAM) === YEARLY };
}

/** `plan=POS&billing=monthly`: the query every intent link carries. */
export function planIntentQuery({ plan, yearly }: PlanIntent): string {
  return `${PLAN_PARAM}=${plan}&${BILLING_PARAM}=${yearly ? YEARLY : MONTHLY}`;
}

/** The setup wizard, carrying the plan. */
export function onboardingPathFor(intent: PlanIntent): string {
  return `/onboarding?${planIntentQuery(intent)}`;
}

/** Sign-up that carries the plan through setup. */
export function registerHrefFor(intent: PlanIntent): string {
  return `/register?next=${encodeURIComponent(onboardingPathFor(intent))}`;
}

/**
 * The pricing page with this plan's confirm already open (PricingCards opens
 * it once the visitor is signed in). `pricingPath` is the localized /pricing.
 */
export function pricingHrefFor(intent: PlanIntent, pricingPath = "/pricing"): string {
  return `${pricingPath}?${planIntentQuery(intent)}#plans`;
}

/** The home page's trial buttons: POS, billed monthly once the 14 free days end. */
export const POS_TRIAL_INTENT: PlanIntent = { plan: "POS", yearly: false };
export const POS_TRIAL_REGISTER_HREF = registerHrefFor(POS_TRIAL_INTENT);

/** The Checkout publishing goes on to. */
export interface PlanCheckout extends PlanIntent {
  /** Checkout adds the 14-day trial: a card, nothing charged today. */
  trial: boolean;
}

/**
 * What publishing the store goes on to. Everyone who finishes setup gets the
 * 14-day POS trial (no card), unless they came from the Operations button on
 * the pricing page, which goes on to the Operations Checkout. The billing
 * interval is the one picked on the pricing page when it was for this same
 * plan, monthly otherwise. Null stays on Free: an account that can't use a
 * self-serve Checkout (already paying, or an admin-quoted price pending), or
 * one whose trial is spent (a paid POS Checkout is never opened unasked).
 */
export function checkoutAfterPublish(
  billing: OnboardingBilling,
  intent: PlanIntent | null
): PlanCheckout | null {
  if (!billing.canCheckout) return null;
  if (intent?.plan === "OPERATIONS") return { plan: "OPERATIONS", yearly: intent.yearly, trial: false };
  if (billing.posTrialEligible) {
    return { plan: "POS", yearly: intent?.plan === "POS" ? intent.yearly : false, trial: true };
  }
  return intent?.plan === "POS" ? { plan: "POS", yearly: intent.yearly, trial: false } : null;
}
