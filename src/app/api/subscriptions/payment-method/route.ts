import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { paymentMethodSessionSchema } from "@/lib/validation/subscription.schemas";
import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * GET /api/subscriptions/payment-method
 *
 * Whether Stripe has a card to charge when the POS trial ends. Asked by the
 * Billing page's trial notice only, so the subscription status route (read on
 * every page) never waits on Stripe.
 *
 * Returns: { hasPaymentMethod: boolean }
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const hasPaymentMethod = await subscriptionService.hasPaymentMethod(userId);
    return NextResponse.json(createSuccessResponse({ hasPaymentMethod }));
  },
  { rateLimitEndpoint: "/api/subscriptions/payment-method" }
);

/**
 * POST /api/subscriptions/payment-method
 *
 * Billing → Add a card: Stripe's billing portal opened on "add a payment
 * method". The card becomes the one the trial renews on.
 *
 * Body: { returnPath?: string } (an app path; defaults to /stores)
 * Returns: { url: string }
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { returnPath } = paymentMethodSessionSchema.parse(body);
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const path = safeInternalPath(returnPath ?? null) ?? "/stores";

    const session = await subscriptionService.createPaymentMethodSession(
      userId,
      `${origin}${path}`
    );
    return NextResponse.json(createSuccessResponse({ url: session.url }));
  },
  { rateLimitEndpoint: "/api/subscriptions/payment-method" }
);
