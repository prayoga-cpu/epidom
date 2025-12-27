import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
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

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No active subscription found"),
        { status: 404 }
      );
    }

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/profile`,
    });

    return NextResponse.json(
      createSuccessResponse({
        url: portalSession.url,
        message: "Portal link created successfully",
      })
    );
  },
  { rateLimitEndpoint: "/api/billing/portal", requireStoreAuth: false }
);
