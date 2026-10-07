import type { OnboardingBilling, OnboardingGoal } from "@/lib/onboarding/contracts";
import { planRank, type PlanTier } from "@/lib/plans/entitlements";

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
 * In the wizard the plan pre-ticks its goal on step 3, and publishing goes on
 * to that plan's Checkout (checkoutAfterPublish). An account that finished
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

/** The plan that unlocks each goal on step 3. */
export const GOAL_PLAN: Record<OnboardingGoal, PlanTier> = {
  storefront: "FREE",
  counter: "POS",
  operations: "OPERATIONS",
};

/** The goal a plan intent ticks on step 3. */
export const INTENT_GOAL: Record<IntentPlan, OnboardingGoal> = {
  POS: "counter",
  OPERATIONS: "operations",
};

function isIntentPlan(plan: PlanTier): plan is IntentPlan {
  return plan === "POS" || plan === "OPERATIONS";
}

/** The paid plan the picked goals ask for: the highest one, or null for storefront-only or none. */
export function planForGoals(goals: readonly OnboardingGoal[]): IntentPlan | null {
  let best: IntentPlan | null = null;
  for (const goal of goals) {
    const plan = GOAL_PLAN[goal];
    if (isIntentPlan(plan) && (best === null || planRank(plan) > planRank(best))) best = plan;
  }
  return best;
}

/** The Checkout publishing goes on to. */
export interface PlanCheckout extends PlanIntent {
  /** Checkout adds the 14-day trial: a card, nothing charged today. */
  trial: boolean;
}

/**
 * What publishing the store goes on to: the Checkout for the plan the picked
 * goals ask for, or null to stay on Free. The billing interval is the one the
 * visitor picked on the pricing page when it was for this same plan, monthly
 * otherwise. An account that can't use a self-serve Checkout (already paying,
 * or an admin-quoted price pending) gets nothing here.
 */
export function checkoutAfterPublish(
  goals: readonly OnboardingGoal[],
  billing: OnboardingBilling,
  intent: PlanIntent | null
): PlanCheckout | null {
  if (!billing.canCheckout) return null;
  const plan = planForGoals(goals);
  if (!plan) return null;
  return {
    plan,
    yearly: intent?.plan === plan ? intent.yearly : false,
    trial: plan === "POS" && billing.posTrialEligible,
  };
}
