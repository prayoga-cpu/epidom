import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
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
    const { plan, successUrl, cancelUrl } = checkoutSchema.parse(body);

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

    // Create checkout session
    const checkoutSession = await subscriptionService.createCheckoutSession(
      userId,
      plan,
      finalSuccessUrl,
      finalCancelUrl
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
