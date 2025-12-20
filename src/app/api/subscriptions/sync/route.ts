import { NextResponse } from "next/server";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import Stripe from "stripe";
import { extractSubscriptionPeriod, isSubscriptionCanceling } from "@/types/stripe";

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

    // Get all active subscriptions from Stripe for this customer
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      status: "active",
      limit: 10,
      expand: ["data.items.data.price"], // Expand price data for plan detection
    });

    if (stripeSubscriptions.data.length === 0) {
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
    const activeSubscription = stripeSubscriptions.data.sort((a, b) => b.created - a.created)[0];

    // Cancel any duplicate subscriptions
    // Limit to 5 cancellations per request to prevent timeouts
    if (stripeSubscriptions.data.length > 1) {
      const duplicates = stripeSubscriptions.data.slice(1, 6); // Take max 5 duplicates

      for (const dup of duplicates) {
        try {
          await stripe.subscriptions.cancel(dup.id, { prorate: false });
        } catch (e) {
          console.error(`Failed to cancel duplicate subscription ${dup.id}:`, e);
          // Continue even if one fails
        }
      }
    }

    // Get the plan from the subscription
    // Type-safe access to price data
    const priceId = activeSubscription.items.data[0].price.id;
    const unitAmount = activeSubscription.items.data[0].price.unit_amount;

    let plan: SubscriptionPlan;

    // Determine plan based on metadata or price amount
    if (activeSubscription.metadata?.plan) {
      // Validate metadata value against Enum
      const metaPlan = activeSubscription.metadata.plan as string;
      if (metaPlan === "STARTER" || metaPlan === "PRO") {
        plan = metaPlan as SubscriptionPlan;
      } else {
        // Metadata invalid, fallback to price check
        plan = determinePlanByPrice(unitAmount);
      }
    } else {
      plan = determinePlanByPrice(unitAmount);
    }

    // Fallback to existing DB plan if we still can't determine
    if (!plan && dbSubscription.plan) {
      plan = dbSubscription.plan;
    }

    // Extract period dates using type-safe helper
    const period = extractSubscriptionPeriod(activeSubscription);
    const cancelAtPeriodEnd = isSubscriptionCanceling(activeSubscription);

    // Update database to match Stripe
    // Using proper type access, no 'any' casting needed
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: activeSubscription.id,
      stripePriceId: priceId,
      plan: plan || SubscriptionPlan.STARTER, // Default fallback
      status: SubscriptionStatus.ACTIVE,
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
          plan: plan,
          status: "ACTIVE",
        },
        duplicatesCanceled: Math.max(0, stripeSubscriptions.data.length - 1),
      })
    );
  },
  {
    // Strict rate limit for sync operations to protect backend
    rateLimitEndpoint: "/api/subscriptions/sync",
  }
);

/**
 * Helper to determine plan from price amount
 */
function determinePlanByPrice(amount: number | null): SubscriptionPlan {
  if (amount === 1900) return SubscriptionPlan.STARTER; // $19
  if (amount === 4900) return SubscriptionPlan.PRO; // $49
  return SubscriptionPlan.STARTER; // Default safest option
}
