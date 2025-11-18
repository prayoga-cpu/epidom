import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    // Create Stripe Customer Portal session
    const session_url = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/profile`,
    });

    return NextResponse.json({
      url: session_url.url,
      message: "Portal link created successfully",
    });
  } catch (error: any) {
    // Handle missing portal configuration
    if (error.type === "StripeInvalidRequestError" && error.code === "resource_missing") {
      return NextResponse.json(
        {
          error: "Billing portal is not configured",
          details:
            "Please visit https://dashboard.stripe.com/test/settings/billing/portal to configure the customer portal in Stripe Dashboard",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to create portal link",
        details: process.env.NODE_ENV === "development" ? error.type || error.code : undefined,
      },
      { status: 500 }
    );
  }
}
