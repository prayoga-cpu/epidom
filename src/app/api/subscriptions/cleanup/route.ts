/**
 * @file api/subscriptions/cleanup/route.ts
 * @description Subscription Cleanup API
 * Aggressive cleanup tool for fixing subscription state desynchronization.
 */

import { NextResponse } from "next/server";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import Stripe from "stripe";
import { extractSubscriptionPeriod, isSubscriptionCanceling } from "@/types/stripe";

/**
 * POST /api/subscriptions/cleanup
 *
 * Aggressively cleans up all duplicate subscriptions in Stripe for the user.
 *
 * Strategy:
 * 1. Fetch ALL subscriptions for the customer.
 * 2. Identify "Winner" (Newest PRO > Newest STARTER).
 * 3. Cancel all "Losers".
 * 4. Sync Database to "Winner".
 *
 * Query Params:
 * - dryRun=true (Simulation mode)
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Check for dry run mode
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

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

    const activeSubscriptions = allSubscriptions.data.filter((sub) => sub.status === "active");

    if (activeSubscriptions.length === 0) {
      return NextResponse.json(
        createSuccessResponse({
          message: "No active subscriptions found",
          action: "none",
        })
      );
    }

    // Sort to find the "Winner"
    // Criteria: PRO > STARTER, then Newest > Oldest
    const sorted = activeSubscriptions.sort((a, b) => {
      const planA = determinePlan(a);
      const planB = determinePlan(b);

      if (planA === SubscriptionPlan.PRO && planB !== SubscriptionPlan.PRO) return -1;
      if (planB === SubscriptionPlan.PRO && planA !== SubscriptionPlan.PRO) return 1;

      return b.created - a.created;
    });

    // The Winner
    const keepSubscription = sorted[0];
    const keepPlan = determinePlan(keepSubscription);

    // The Losers
    const toCancel = sorted.slice(1);

    // Dry Run Response
    if (dryRun) {
      return NextResponse.json(
        createSuccessResponse({
          message: "[DRY RUN] Simulation complete",
          action: toCancel.length > 0 ? "cleanup_duplicates" : "update_db_only",
          keep: {
            id: keepSubscription.id,
            plan: keepPlan,
            created: new Date(keepSubscription.created * 1000).toISOString(),
          },
          cancel: toCancel.map((sub) => ({
            id: sub.id,
            plan: determinePlan(sub),
            created: new Date(sub.created * 1000).toISOString(),
          })),
        })
      );
    }

    // Actual Execution: Cancel Duplicates
    const canceledIds: string[] = [];
    for (const sub of toCancel) {
      try {
        await stripe.subscriptions.cancel(sub.id, { prorate: false });
        canceledIds.push(sub.id);
      } catch (error) {
        console.warn(`Failed to cancel subscription ${sub.id}`, error);
      }
    }

    // Extract period dates using type-safe helper
    const period = extractSubscriptionPeriod(keepSubscription);
    const cancelAtPeriodEnd = isSubscriptionCanceling(keepSubscription);

    // Actual Execution: Update Database
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: keepSubscription.id,
      stripePriceId: keepSubscription.items.data[0].price.id,
      plan: keepPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: period?.currentPeriodStart ?? new Date(),
      currentPeriodEnd: period?.currentPeriodEnd ?? new Date(),
      cancelAtPeriodEnd,
    });

    return NextResponse.json(
      createSuccessResponse({
        message: `Successfully cleaned up ${canceledIds.length} duplicate subscriptions`,
        kept: {
          id: keepSubscription.id,
          plan: keepPlan,
          status: "ACTIVE",
        },
        canceled: canceledIds,
      })
    );
  },
  {
    rateLimitEndpoint: "/api/subscriptions/cleanup",
  }
);

/**
 * Determine plan from subscription
 */
function determinePlan(subscription: Stripe.Subscription): SubscriptionPlan {
  // Try metadata first
  if (subscription.metadata?.plan) {
    const plan = subscription.metadata.plan as string;
    if (plan === "STARTER" || plan === "PRO") return plan as SubscriptionPlan;
  }

  // Fallback to price amount
  const amount = subscription.items.data[0]?.price.unit_amount;
  if (amount === 1900) return SubscriptionPlan.STARTER;
  if (amount === 4900) return SubscriptionPlan.PRO;

  return SubscriptionPlan.STARTER;
}
