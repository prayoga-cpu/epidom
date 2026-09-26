import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { subscriptionService } from "@/lib/services";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * POST /api/billing/portal
 *
 * Generate a Stripe Customer Portal link for subscription management
 * Allows users to manage their subscription, payment method, and billing info
 *
 * Required: User must be authenticated
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Get user subscription with Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    if (
      !subscription?.stripeCustomerId ||
      subscription.stripeCustomerId.startsWith("free_") ||
      subscription.stripeCustomerId.startsWith("admin_")
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No active subscription found on Stripe"),
        { status: 404 }
      );
    }

    // Get origin for building absolute URL — prefer the request's own origin so
    // the user returns to the domain they came from (apex vs www).
    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create Stripe Customer Portal session (replaces a customer id Stripe no
    // longer knows, e.g. one from the previous Stripe account)
    const portalSession = await subscriptionService.createPortalSession(
      userId,
      `${origin}/profile`
    );

    return NextResponse.json(
      createSuccessResponse({
        url: portalSession.url,
        message: "Portal link created successfully",
      })
    );
  },
  { rateLimitEndpoint: "/api/billing/portal", requireStoreAuth: false }
);
