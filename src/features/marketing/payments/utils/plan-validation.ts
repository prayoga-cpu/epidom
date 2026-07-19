/**
 * Plan Validation Utilities
 *
 * Centralized plan validation and type checking utilities.
 * Follows DRY principle to avoid duplication.
 */

export type PlanType = "starter" | "pro" | "enterprise";
export type StripePlanType = "FREE" | "FREE" | "POS" | "OPERATIONS";

export const VALID_PLANS: readonly PlanType[] = ["starter", "pro", "enterprise"] as const;
export const STRIPE_PLANS: readonly StripePlanType[] = ["POS", "OPERATIONS"] as const;

/**
 * Validates if a string is a valid plan type
 */
export function isValidPlan(plan: string | undefined): plan is PlanType {
  return plan !== undefined && VALID_PLANS.includes(plan as PlanType);
}

/**
 * Gets a valid plan or defaults to "starter"
 */
export function getValidPlan(plan: string | undefined): PlanType {
  return isValidPlan(plan) ? plan : "starter";
}

/**
 * Converts plan to Stripe format (POS or OPERATIONS)
 * Only valid for starter and pro plans
 */
export function toStripePlan(plan: PlanType): StripePlanType | null {
  if (plan === "starter") return "POS";
  if (plan === "pro") return "OPERATIONS";
  return null; // Enterprise doesn't use Stripe
}

/**
 * Checks if plan is a Stripe-supported plan
 */
export function isStripePlan(plan: PlanType): plan is "starter" | "pro" {
  return plan === "starter" || plan === "pro";
}
