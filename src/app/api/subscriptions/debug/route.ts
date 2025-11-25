import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

type SubscriptionDetail = {
  id: string;
  status: string;
  plan: string;
  priceId: string | undefined;
  amount: number | null | undefined;
  currency: string | undefined;
  created: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

/**
 * GET /api/subscriptions/debug
 *
 * Show all subscriptions in Stripe for debugging
 * This helps identify duplicate/stuck subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get subscription from database
    const dbSubscription = await subscriptionRepository.findByUserId(userId);

    if (!dbSubscription) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No subscription found in database"),
        { status: 404 }
      );
    }

    // Get ALL subscriptions from Stripe (active, canceled, all statuses)
    const allSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      limit: 100, // Get all subscriptions
    });

    const subscriptionDetails = allSubscriptions.data.map((sub: Stripe.Subscription) => ({
      id: sub.id,
      status: sub.status,
      plan: sub.metadata?.plan || "unknown",
      priceId: sub.items.data[0]?.price.id,
      amount: sub.items.data[0]?.price.unit_amount,
      currency: sub.items.data[0]?.price.currency,
      created: new Date(sub.created * 1000).toISOString(),
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: number (Unix timestamp in seconds)
       * TODO: Use proper Stripe type definitions or create extended type
       */
      currentPeriodStart: new Date((sub as any).current_period_start * 1000).toISOString(),
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: number (Unix timestamp in seconds)
       * TODO: Use proper Stripe type definitions or create extended type
       */
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: boolean
       * TODO: Use proper Stripe type definitions or create extended type
       */
      cancelAtPeriodEnd: (sub as any).cancel_at_period_end || false,
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: number | null (Unix timestamp in seconds)
       * TODO: Use proper Stripe type definitions or create extended type
       */
      canceledAt: (sub as any).canceled_at
        ? new Date((sub as any).canceled_at * 1000).toISOString()
        : null,
    }));

    // Group by status
    const grouped = {
      active: subscriptionDetails.filter((s: SubscriptionDetail) => s.status === "active"),
      canceled: subscriptionDetails.filter((s: SubscriptionDetail) => s.status === "canceled"),
      other: subscriptionDetails.filter(
        (s: SubscriptionDetail) => s.status !== "active" && s.status !== "canceled"
      ),
    };

    return NextResponse.json(
      createSuccessResponse({
        database: {
          plan: dbSubscription.plan,
          status: dbSubscription.status,
          stripeSubscriptionId: dbSubscription.stripeSubscriptionId,
          stripeCustomerId: dbSubscription.stripeCustomerId,
        },
        stripe: {
          total: allSubscriptions.data.length,
          active: grouped.active.length,
          canceled: grouped.canceled.length,
          other: grouped.other.length,
        },
        subscriptions: {
          active: grouped.active,
          canceled: grouped.canceled,
          other: grouped.other,
        },
        issues: {
          hasMultipleActive: grouped.active.length > 1,
          dbMismatch:
            grouped.active.length > 0 &&
            !grouped.active.find(
              (s: SubscriptionDetail) => s.id === dbSubscription.stripeSubscriptionId
            ),
        },
      })
    );
  } catch (error) {
    return handleApiError(error, {
      endpoint: "GET /api/subscriptions/debug",
      context: {},
    });
  }
}
