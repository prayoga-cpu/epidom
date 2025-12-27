import { NextResponse } from "next/server";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { portalSchema } from "@/lib/validation/subscription.schemas";

/**
 * POST /api/subscriptions/portal
 *
 * Create Stripe Customer Portal Session
 * Allows users to manage subscription, payment methods, and invoices
 *
 * Body:
 * - returnUrl?: string (optional, defaults to /profile)
 *
 * Returns:
 * - url: Redirect URL to Stripe Customer Portal
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Parse request body (optional)
    const body = await request.json().catch(() => ({}));

    // Validate
    const { returnUrl } = portalSchema.parse(body);

    // Get origin for building absolute URL
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Build return URL
    const finalReturnUrl = returnUrl
      ? returnUrl.startsWith("http")
        ? returnUrl
        : `${origin}${returnUrl}`
      : `${origin}/profile`;

    // Create portal session
    const portalSession = await subscriptionService.createPortalSession(userId, finalReturnUrl);

    return NextResponse.json(
      createSuccessResponse({
        url: portalSession.url,
        message: "Portal session created successfully",
      })
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/portal",
  }
);
