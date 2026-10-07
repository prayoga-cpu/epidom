/** Length of the POS plan's free trial. Checkout collects a card and charges nothing until it ends. */
export const POS_TRIAL_DAYS = 14;

/**
 * Whether a Checkout for `plan` gets the free trial. It is POS-only and
 * first-time-only: an account that ever had a Stripe subscription (it keeps
 * its stripeSubscriptionId after cancelling) has had its trial. Decided on the
 * server, whatever a page asks for.
 */
export function posTrialApplies(
  plan: string,
  subscription: { stripeSubscriptionId: string | null } | null | undefined
): boolean {
  return plan === "POS" && !subscription?.stripeSubscriptionId;
}
