import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscriptionRepository } from "@/lib/repositories";
import { stripe } from "@/lib/stripe";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

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
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const userId = session.user.id;

    // Get current subscription from database
    const dbSubscription = await subscriptionRepository.findByUserId(userId);

    if (!dbSubscription) {
      return NextResponse.json(
        { error: "No subscription found in database" },
        { status: 404 }
      );
    }

    // Get all active subscriptions from Stripe for this customer
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: dbSubscription.stripeCustomerId,
      status: "active",
      limit: 10,
    });

    if (stripeSubscriptions.data.length === 0) {
      // No active subscriptions in Stripe
      if (dbSubscription.status !== SubscriptionStatus.CANCELED) {
        await subscriptionRepository.update(userId, {
          status: SubscriptionStatus.CANCELED,
        });
      }

      return NextResponse.json({
        message: "No active subscription in Stripe. Database updated to CANCELED.",
        dbStatus: "CANCELED",
        stripeStatus: "none",
      });
    }

    // Get the newest active subscription
    const activeSubscription = stripeSubscriptions.data.sort((a, b) => b.created - a.created)[0];

    // Cancel any duplicate subscriptions
    if (stripeSubscriptions.data.length > 1) {
      const duplicates = stripeSubscriptions.data.slice(1);

      for (const dup of duplicates) {
        await stripe.subscriptions.cancel(dup.id, { prorate: false });
      }
    }

    // Get the plan from the subscription
    const priceId = activeSubscription.items.data[0].price.id;
    let plan: SubscriptionPlan;

    // Match price ID to plan (you'll need to import STRIPE_CONFIG or check your config)
    // For now, we'll try to get it from metadata or deduce it
    if (activeSubscription.metadata?.plan) {
      plan = activeSubscription.metadata.plan as SubscriptionPlan;
    } else {
      // Fallback: check the price amount
      const price = activeSubscription.items.data[0].price;
      if (price.unit_amount === 1900) {
        // $19/month
        plan = SubscriptionPlan.STARTER;
      } else if (price.unit_amount === 4900) {
        // $49/month
        plan = SubscriptionPlan.PRO;
      } else {
        plan = dbSubscription.plan; // Keep current plan if can't determine
      }
    }

    // Update database to match Stripe
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: activeSubscription.id,
      stripePriceId: priceId,
      plan: plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date((activeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((activeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (activeSubscription as any).cancel_at_period_end,
    });

    return NextResponse.json({
      message: "Subscription synced successfully with Stripe",
      before: {
        plan: dbSubscription.plan,
        status: dbSubscription.status,
      },
      after: {
        plan: plan,
        status: "ACTIVE",
      },
      duplicatesCanceled: stripeSubscriptions.data.length - 1,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to sync subscription" },
      { status: 500 }
    );
  }
}
