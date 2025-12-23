/**
 * @file api/subscriptions/debug/route.ts
 * @description Subscription Debug API
 * Returns raw Stripe vs Database subscription data comparison for debugging.
 */

import { NextResponse } from "next/server";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import {
  extractSubscriptionPeriod,
  isSubscriptionCanceling,
  isSubscriptionWithPeriod,
} from "@/types/stripe";

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
 * Retrieves comprehensive debug info about user's subscription state.
 * compares local DB record with live Stripe data.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    // Get subscription from database
    const dbSubscription = await subscriptionRepository.findByUserId(userId);

    if (!dbSubscription) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No subscription found in database"),
        { status: 404 }
      );
    }

    // Get ALL subscriptions from Stripe
    const allSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      limit: 100,
    });

    // Map to simplified debug object
    const subscriptionDetails: SubscriptionDetail[] = allSubscriptions.data.map(
      (sub: Stripe.Subscription) => {
        const period = extractSubscriptionPeriod(sub);
        return {
          id: sub.id,
          status: sub.status,
          plan: sub.metadata?.plan || "unknown",
          priceId: sub.items.data[0]?.price.id,
          amount: sub.items.data[0]?.price.unit_amount,
          currency: sub.items.data[0]?.price.currency,
          created: new Date(sub.created * 1000).toISOString(),
          currentPeriodStart: period?.currentPeriodStart.toISOString() || new Date().toISOString(),
          currentPeriodEnd: period?.currentPeriodEnd.toISOString() || new Date().toISOString(),
          cancelAtPeriodEnd: isSubscriptionCanceling(sub),
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        };
      }
    );

    // Group for analysis
    const grouped = {
      active: subscriptionDetails.filter((s) => s.status === "active"),
      canceled: subscriptionDetails.filter((s) => s.status === "canceled"),
      other: subscriptionDetails.filter((s) => s.status !== "active" && s.status !== "canceled"),
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
        subscriptions: grouped,
        issues: {
          hasMultipleActive: grouped.active.length > 1,
          dbMismatch:
            grouped.active.length > 0 &&
            !grouped.active.find((s) => s.id === dbSubscription.stripeSubscriptionId),
        },
      })
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/debug",
  }
);
