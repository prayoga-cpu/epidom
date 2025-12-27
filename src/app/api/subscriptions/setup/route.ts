/**
 * POST /api/subscriptions/setup
 *
 * Create Stripe Checkout Session in SETUP mode
 * This validates the card without charging, then grants PRO plan
 *
 * Flow:
 * 1. User registers
 * 2. User is redirected here to validate their card
 * 3. Card is validated (no charge)
 * 4. User gets PRO plan until Dec 31, 2025
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL to Stripe Checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";

import { stripe } from "@/lib/stripe";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { userRepository } from "@/lib/repositories/user.repository";
import { subscriptionRepository } from "@/lib/repositories/subscription.repository";

export async function POST(request: NextRequest) {
  let session: Session | null = null;

  try {
    // Verify session
    session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Please log in to continue"),
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionRepository.findByUserId(userId);
    if (existingSubscription?.status === "ACTIVE") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "You already have an active subscription"),
        { status: 409 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = existingSubscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: {
          userId: userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Build URLs
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const successUrl = `${origin}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/onboarding?canceled=true`;

    // Create Checkout Session in SETUP mode
    // This only validates the card, doesn't charge anything
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "setup",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId,
        promotion: "new_year_2025",
        plan: "PRO",
      },
    });

    return NextResponse.json(
      createSuccessResponse({
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        message: "Setup session created successfully",
      }),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/subscriptions/setup",
      context: { userId: session?.user?.id },
    });
  }
}
