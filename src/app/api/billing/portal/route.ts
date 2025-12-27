import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * POST /api/billing/portal
 *
 * Generate a Stripe Customer Portal link for subscription management
 * Allows users to manage their subscription, payment method, and billing info
 *
 * Required: User must be authenticated
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user subscription with Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No active subscription found"),
        { status: 404 }
      );
    }

    // Create Stripe Customer Portal session
    const session_url = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/profile`,
    });

    return NextResponse.json(
      createSuccessResponse({
        url: session_url.url,
        message: "Portal link created successfully",
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/billing/portal",
      context: {},
    });
  }
}
