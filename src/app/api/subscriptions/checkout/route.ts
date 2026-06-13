import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { checkoutSchema } from "@/lib/validation/subscription.schemas";

/**
 * POST /api/subscriptions/checkout
 *
 * Create Stripe Checkout Session for subscription
 *
 * Body:
 * - plan: "FREE" | "FREE" | "POS" | "OPERATIONS"
 * - successUrl?: string (optional, defaults to /checkout/success)
 * - cancelUrl?: string (optional, defaults to /checkout/failed)
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL to Stripe Checkout
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Parse and validate request body
    const body = await request.json();
    const { plan, successUrl, cancelUrl, trial, yearly } = checkoutSchema.parse(body);

    // Get origin for building absolute URLs
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Build success and cancel URLs
    const finalSuccessUrl = successUrl
      ? successUrl.startsWith("http")
        ? successUrl
        : `${origin}${successUrl}`
      : `${origin}/checkout/success?plan=${plan}`;

    const finalCancelUrl = cancelUrl
      ? cancelUrl.startsWith("http")
        ? cancelUrl
        : `${origin}${cancelUrl}`
      : `${origin}/checkout/failed?reason=canceled`;

    // Check if user already has a paid subscription (with a real Stripe customer)
    const subscription = await subscriptionRepository.findByUserId(userId);
    if (
      subscription &&
      subscription.status === "ACTIVE" &&
      subscription.plan !== "FREE" &&
      !subscription.stripeCustomerId.startsWith("free_")
    ) {
      // User is already paid. Redirect to Customer Portal to handle upgrade/downgrade prorations.
      const portalSession = await subscriptionService.createPortalSession(userId, `${origin}/stores`);
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
      trial,
      yearly
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
