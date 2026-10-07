import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { checkoutSchema } from "@/lib/validation/subscription.schemas";
import { posTrialApplies } from "@/lib/plans/pos-trial";

/**
 * POST /api/subscriptions/checkout
 *
 * Create Stripe Checkout Session for subscription
 *
 * Body:
 * - plan: "FREE" | "FREE" | "POS" | "OPERATIONS"
 * - successUrl?: string (optional, defaults to /checkout/success)
 * - cancelUrl?: string (optional, defaults to /checkout/failed)
 * - currency?: "EUR" | "USD" | "IDR" (the currency the page quoted; see createCheckoutSession)
 * - next?: string (an app path the default success / cancel pages lead on to)
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL to Stripe Checkout
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Parse and validate request body
    const body = await request.json();
    const { plan, successUrl, cancelUrl, yearly, currency, next } = checkoutSchema.parse(body);

    // Get origin for building absolute URLs
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Check if user already has a paid subscription (with a real Stripe customer)
    const subscription = await subscriptionRepository.findByUserId(userId);

    // The 14-day free trial is POS-only and first-time-only. We derive it server-side
    // (ignoring any client-sent flag) so the trial can't be applied to other plans or
    // claimed twice — a returning subscriber already has a stripeSubscriptionId.
    const applyTrial = posTrialApplies(plan, subscription);

    // Build success and cancel URLs. `trial` lets the success page fire a
    // distinct "trial started" conversion (GA4 trial_started, Meta
    // StartTrial) instead of treating every checkout as an immediate paid
    // subscription — only relevant on the default URL; a caller-supplied
    // successUrl is used verbatim. `next` is where both default pages lead on
    // to; the cancel page also gets the plan, so "Try again" reopens it.
    const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
    const finalSuccessUrl = successUrl
      ? successUrl.startsWith("http")
        ? successUrl
        : `${origin}${successUrl}`
      : `${origin}/checkout/success?plan=${plan}&trial=${applyTrial}${nextQuery}`;

    const finalCancelUrl = cancelUrl
      ? cancelUrl.startsWith("http")
        ? cancelUrl
        : `${origin}${cancelUrl}`
      : `${origin}/checkout/failed?reason=canceled&plan=${plan}&billing=${yearly ? "yearly" : "monthly"}${nextQuery}`;

    if (
      subscription &&
      subscription.status === "ACTIVE" &&
      subscription.plan !== "FREE" &&
      !subscription.stripeCustomerId.startsWith("free_")
    ) {
      // User is already paid. Redirect to Customer Portal to handle upgrade/downgrade prorations.
      const portalSession = await subscriptionService.createPortalSession(
        userId,
        `${origin}/stores`
      );
      return NextResponse.json(
        createSuccessResponse({
          sessionId: portalSession.id,
          url: portalSession.url,
          message: "Redirecting to portal for plan change",
        }),
        { status: 201 }
      );
    }

    // Create checkout session
    const checkoutSession = await subscriptionService.createCheckoutSession(
      userId,
      plan,
      finalSuccessUrl,
      finalCancelUrl,
      applyTrial,
      yearly,
      currency
    );

    return NextResponse.json(
      createSuccessResponse({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        message: "Checkout session created successfully",
      }),
      { status: 201 }
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/checkout",
  }
);
