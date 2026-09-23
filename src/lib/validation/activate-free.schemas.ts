import { z } from "zod";

/**
 * POST /api/subscriptions/activate-free body.
 *
 * That route provisions a plan with no payment step, so the only plan a client
 * may ever name is FREE. Paid tiers go through /api/subscriptions/checkout and
 * are granted by the Stripe webhook. SubscriptionService.activateFree is FREE-only
 * too; the one no-payment paid grant (the admin-gated demo seed) goes through
 * SubscriptionService.grantPlanWithoutPayment, never through this schema.
 *
 * `plan` is optional so a bare POST keeps working. Unknown keys are dropped
 * rather than rejected: the pricing page sends `trial`/`yearly` alongside it.
 */
export const ACTIVATE_FREE_ONLY_MESSAGE =
  "Only the FREE plan can be activated here. Paid plans start from checkout.";

export const activateFreeSchema = z.object({
  plan: z
    .literal("FREE", {
      errorMap: () => ({ message: ACTIVATE_FREE_ONLY_MESSAGE }),
    })
    .optional(),
});

export type ActivateFreeInput = z.infer<typeof activateFreeSchema>;
