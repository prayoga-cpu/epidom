import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { customPriceCheckoutSchema } from "@/lib/validation/subscription.schemas";

/**
 * POST /api/subscriptions/custom-price/checkout
 *
 * Create a Stripe Checkout Session for the custom price an admin quoted this
 * account. Only valid while the offer is pending (Subscription.
 * customPricePendingAt) — the price comes from the stored offer, never from the
 * client, so there is nothing to negotiate here.
 *
 * Body:
 * - successUrl?: string (optional, defaults to /checkout/success)
 * - cancelUrl?: string (optional, defaults to /checkout/failed)
 *
 * Returns:
 * - sessionId / url: Stripe Checkout redirect
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { successUrl, cancelUrl } = customPriceCheckoutSchema.parse(body);

    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const toAbsolute = (url: string) => (url.startsWith("http") ? url : `${origin}${url}`);

    const session = await subscriptionService.createCustomPriceCheckoutSession(
      userId,
      successUrl ? toAbsolute(successUrl) : `${origin}/checkout/success?custom=true`,
      cancelUrl ? toAbsolute(cancelUrl) : `${origin}/checkout/failed?reason=canceled`
    );

    return NextResponse.json(
      createSuccessResponse({
        sessionId: session.id,
        url: session.url,
        message: "Custom price checkout session created successfully",
      }),
      { status: 201 }
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/custom-price/checkout",
  }
);
