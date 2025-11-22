import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

/**
 * POST /api/subscriptions/cleanup
 *
 * Aggressively clean up all duplicate subscriptions
 *
 * Strategy:
 * 1. Get ALL subscriptions (active, canceled, everything)
 * 2. Identify which one to keep (newest PRO if exists, otherwise newest STARTER)
 * 3. Cancel ALL others immediately
 * 4. Update database to match the kept subscription
 *
 * Query params:
 * - dryRun=true: Show what would be done without actually doing it
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check for dry run mode
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";

    // Get subscription from database
    const dbSubscription = await subscriptionRepository.findByUserId(userId);

    if (!dbSubscription) {
      return NextResponse.json({ error: "No subscription found in database" }, { status: 404 });
    }

    // Get ALL subscriptions from Stripe (all statuses)
    const allSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      limit: 100,
    });
    // Filter to only active ones
    const activeSubscriptions = allSubscriptions.data.filter((sub) => sub.status === "active");
    if (activeSubscriptions.length === 0) {
      return NextResponse.json({
        message: "No active subscriptions found",
        action: "none",
      });
    }

    if (activeSubscriptions.length === 1) {
      const sub = activeSubscriptions[0];

      // Just sync the database with this one subscription
      const plan = determinePlan(sub);

      if (dryRun) {
        return NextResponse.json({
          message: "[DRY RUN] Would update database to match single subscription",
          action: "update_db_only",
          subscription: {
            id: sub.id,
            plan: plan,
            status: sub.status,
          },
        });
      }

      await subscriptionRepository.update(userId, {
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0].price.id,
        plan: plan,
        status: SubscriptionStatus.ACTIVE,
        /**
         * Type assertion needed because Stripe API types don't expose all properties
         * Actual type: number (Unix timestamp in seconds)
         * TODO: Use proper Stripe type definitions or create extended type
         */
        currentPeriodStart: new Date((sub as any).current_period_start * 1000),
        /**
         * Type assertion needed because Stripe API types don't expose all properties
         * Actual type: number (Unix timestamp in seconds)
         * TODO: Use proper Stripe type definitions or create extended type
         */
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        /**
         * Type assertion needed because Stripe API types don't expose all properties
         * Actual type: boolean
         * TODO: Use proper Stripe type definitions or create extended type
         */
        cancelAtPeriodEnd: (sub as any).cancel_at_period_end || false,
      });

      return NextResponse.json({
        message: "Database synced with single active subscription",
        subscription: {
          id: sub.id,
          plan: plan,
          status: "ACTIVE",
        },
      });
    }

    // Multiple active subscriptions - need to clean up
    // Prioritize: PRO > STARTER, then by creation date (newest first)
    const sorted = activeSubscriptions.sort((a, b) => {
      const planA = determinePlan(a);
      const planB = determinePlan(b);

      // PRO comes before STARTER
      if (planA === SubscriptionPlan.PRO && planB !== SubscriptionPlan.PRO) return -1;
      if (planB === SubscriptionPlan.PRO && planA !== SubscriptionPlan.PRO) return 1;

      // If same plan, newest first
      return b.created - a.created;
    });

    const keepSubscription = sorted[0];
    const toCancel = sorted.slice(1);

    const keepPlan = determinePlan(keepSubscription);

    if (dryRun) {
      return NextResponse.json({
        message: "[DRY RUN] Would keep 1 subscription and cancel the rest",
        action: "cleanup_duplicates",
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
      });
    }

    // Cancel all duplicates
    const canceledIds: string[] = [];
    for (const sub of toCancel) {
      try {
        await stripe.subscriptions.cancel(sub.id, { prorate: false });
        canceledIds.push(sub.id);
      } catch (error: any) {
      }
    }

    // Update database to match the kept subscription
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: keepSubscription.id,
      stripePriceId: keepSubscription.items.data[0].price.id,
      plan: keepPlan,
      status: SubscriptionStatus.ACTIVE,
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: number (Unix timestamp in seconds)
       * TODO: Use proper Stripe type definitions or create extended type
       */
      currentPeriodStart: new Date((keepSubscription as any).current_period_start * 1000),
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: number (Unix timestamp in seconds)
       * TODO: Use proper Stripe type definitions or create extended type
       */
      currentPeriodEnd: new Date((keepSubscription as any).current_period_end * 1000),
      /**
       * Type assertion needed because Stripe API types don't expose all properties
       * Actual type: boolean
       * TODO: Use proper Stripe type definitions or create extended type
       */
      cancelAtPeriodEnd: (keepSubscription as any).cancel_at_period_end || false,
    });
    return NextResponse.json({
      message: `Successfully cleaned up ${canceledIds.length} duplicate subscriptions`,
      kept: {
        id: keepSubscription.id,
        plan: keepPlan,
        status: "ACTIVE",
      },
      canceled: canceledIds,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to cleanup subscriptions" },
      { status: 500 }
    );
  }
}

/**
 * Determine plan from subscription metadata or price
 */
function determinePlan(subscription: any): SubscriptionPlan {
  // Try metadata first
  if (subscription.metadata?.plan) {
    return subscription.metadata.plan as SubscriptionPlan;
  }

  // Fallback to price amount
  const amount = subscription.items.data[0]?.price.unit_amount;

  if (amount === 1900) return SubscriptionPlan.STARTER; // $19/month
  if (amount === 4900) return SubscriptionPlan.PRO; // $49/month

  // Default to STARTER if can't determine
  return SubscriptionPlan.STARTER;
}
