import { NextResponse } from "next/server";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import Stripe from "stripe";
import { extractSubscriptionPeriod, isSubscriptionCanceling } from "@/types/stripe";
import { STRIPE_CONFIG } from "@/config/stripe.config";

/** Stripe statuses that still grant access (trialing and past-due included). */
const LIVE_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "unpaid"];

/**
 * POST /api/subscriptions/sync
 *
 * Sync subscription status with Stripe
 *
 * This endpoint fixes cases where:
 * - Database shows CANCELED but Stripe has an active subscription
 * - Database shows wrong plan compared to Stripe
 * - Database is out of sync with Stripe
 *
 * It fetches the actual subscription from Stripe and updates the database to match.
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Get current subscription from database
    const dbSubscription = await subscriptionRepository.findByUserId(userId);

    if (!dbSubscription) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No subscription found in database"),
        { status: 404 }
      );
    }

    // Never sync an account that is waiting to pay an admin-quoted custom
    // price: any subscription still live in Stripe is the superseded one, and
    // copying it back would hand access out without the new price being paid.
    if (dbSubscription.customPricePendingAt) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.CONFLICT,
          "A custom price is awaiting payment on this account. Complete that checkout from your Billing page instead."
        ),
        { status: 409 }
      );
    }

    // Admin-granted and free accounts have no Stripe customer to sync with.
    if (
      dbSubscription.stripeCustomerId.startsWith("free_") ||
      dbSubscription.stripeCustomerId.startsWith("admin_")
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "This account is not billed through Stripe."),
        { status: 409 }
      );
    }

    // Every subscription that can still grant access. Listing only "active"
    // would write a trialing or past-due subscription off as CANCELED.
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      status: "all",
      limit: 20,
    });
    const liveSubscriptions = stripeSubscriptions.data.filter((s) =>
      LIVE_STATUSES.includes(s.status)
    );

    if (liveSubscriptions.length === 0) {
      // No active subscriptions in Stripe
      if (dbSubscription.status !== SubscriptionStatus.CANCELED) {
        await subscriptionRepository.update(userId, {
          status: SubscriptionStatus.CANCELED,
        });
      }

      return NextResponse.json(
        createSuccessResponse({
          message: "No active subscription in Stripe. Database updated to CANCELED.",
          dbStatus: "CANCELED",
          stripeStatus: "none",
        })
      );
    }

    // Get the newest active subscription
    const activeSubscription = liveSubscriptions.sort((a, b) => b.created - a.created)[0];

    // Cancel any duplicate subscriptions
    // Limit to 5 cancellations per request to prevent timeouts
    if (liveSubscriptions.length > 1) {
      const duplicates = liveSubscriptions.slice(1, 6); // Take max 5 duplicates

      for (const dup of duplicates) {
        try {
          await stripe.subscriptions.cancel(dup.id, { prorate: false });
        } catch (e) {
          console.error(`Failed to cancel duplicate subscription ${dup.id}:`, e);
          // Continue even if one fails
        }
      }
    }

    // The plan follows the price actually being paid. Checkout metadata is
    // written once, so after a plan switch in the Customer Portal it still
    // names the old plan and would hand back a plan the customer stopped
    // paying for. A price outside the catalog (an admin custom price) keeps
    // the plan already on the row.
    const priceId = activeSubscription.items.data[0].price.id;
    const plan = planForPriceId(priceId) ?? dbSubscription.plan;
    const status =
      activeSubscription.status === "past_due" || activeSubscription.status === "unpaid"
        ? SubscriptionStatus.PAST_DUE
        : SubscriptionStatus.ACTIVE;

    // Extract period dates using type-safe helper
    const period = extractSubscriptionPeriod(activeSubscription);
    const cancelAtPeriodEnd = isSubscriptionCanceling(activeSubscription);

    // Update database to match Stripe
    // Using proper type access, no 'any' casting needed
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: activeSubscription.id,
      stripePriceId: priceId,
      plan,
      status,
      currentPeriodStart: period?.currentPeriodStart ?? new Date(),
      currentPeriodEnd: period?.currentPeriodEnd ?? new Date(),
      cancelAtPeriodEnd,
    });

    return NextResponse.json(
      createSuccessResponse({
        message: "Subscription synced successfully with Stripe",
        before: {
          plan: dbSubscription.plan,
          status: dbSubscription.status,
        },
        after: {
          plan,
          status,
        },
        duplicatesCanceled: Math.max(0, liveSubscriptions.length - 1),
      })
    );
  },
  {
    // Strict rate limit for sync operations to protect backend
    rateLimitEndpoint: "/api/subscriptions/sync",
  }
);

/** The plan a catalog price belongs to, or undefined for any other price. */
function planForPriceId(priceId: string): SubscriptionPlan | undefined {
  const { POS, OPERATIONS } = STRIPE_CONFIG.PRICE_IDS;
  if (priceId === POS.MONTHLY || priceId === POS.YEARLY) return SubscriptionPlan.POS;
  if (priceId === OPERATIONS.MONTHLY || priceId === OPERATIONS.YEARLY)
    return SubscriptionPlan.OPERATIONS;
  return undefined;
}
