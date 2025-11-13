import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { subscriptionRepository } from "@/lib/repositories";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe Webhook Handler
 *
 * Handles Stripe events for subscriptions:
 * - checkout.session.completed: Activate subscription after successful payment
 * - customer.subscription.updated: Update subscription details (plan changes, etc.)
 * - customer.subscription.deleted: Cancel subscription
 * - invoice.payment_succeeded: Confirm payment received
 * - invoice.payment_failed: Handle payment failure (lockout user)
 *
 * The 80/20 split is automatically handled by Stripe via:
 * - application_fee_percent: 20% (set in checkout session)
 * - transfer_data.destination: Epidom owner's Connect account (receives 80%)
 *
 * IMPORTANT: Configure webhook endpoint in Stripe Dashboard:
 * 1. Go to https://dashboard.stripe.com/webhooks
 * 2. Add endpoint: https://yourdomain.com/api/webhooks/stripe
 * 3. Select events: checkout.session.completed, customer.subscription.*, invoice.*
 * 4. Copy webhook secret to STRIPE_WEBHOOK_SECRET env variable
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("[Webhook] No Stripe signature found");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error: any) {
    console.error("[Webhook] Signature verification failed:", error.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event type - silently ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: `Webhook handler failed: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Activate subscription after successful payment
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as "STARTER" | "PRO";

  if (!userId || !plan) {
    console.error("[Webhook] Missing metadata in checkout session:", session.id);
    return;
  }

  // Get subscription from Stripe with expanded details
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error("[Webhook] No subscription ID in checkout session:", session.id);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice", "customer"],
  });

  // Cast to access properties TypeScript doesn't recognize
  const subscriptionData = stripeSubscription as any;

  // Convert Unix timestamps (seconds) to JavaScript Date (milliseconds)
  const currentPeriodStart = new Date(subscriptionData.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);

  // Validate dates
  if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
    console.error("[Webhook] Invalid date conversion in checkout.session.completed:", {
      start: subscriptionData.current_period_start,
      end: subscriptionData.current_period_end,
    });
    return; // Don't fail, let subscription.created handle it
  }

  // Check if user already has a subscription (upgrade/downgrade scenario)
  const existingSubscription = await subscriptionRepository.findByUserId(userId);

  if (existingSubscription) {
    // User is upgrading/downgrading
    // The old subscription should have been canceled by subscription.service.ts
    // But let's double-check and cancel if it somehow still exists in Stripe
    if (
      existingSubscription.stripeSubscriptionId &&
      existingSubscription.stripeSubscriptionId !== subscriptionId
    ) {
      try {
        const oldStripeSubscription = await stripe.subscriptions.retrieve(
          existingSubscription.stripeSubscriptionId
        );

        // If old subscription is still active in Stripe, cancel it
        if (oldStripeSubscription.status === "active") {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
        }
      } catch (error: any) {
        // Subscription might already be deleted, that's fine
      }
    }

    // Update the existing subscription record (1 user = 1 subscription due to unique constraint)
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });
  } else {
    // New subscription
    await subscriptionRepository.create({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
    });
  }

  // Note: The 80/20 split transfer happens automatically via Stripe
  // - Platform (developer) receives 20% as application fee
  // - Epidom owner receives 80% via transfer_data.destination
}

/**
 * Handle customer.subscription.created
 * This event is more reliable than checkout.session.completed for subscription data
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan as "STARTER" | "PRO";

  if (!userId || !plan) {
    return; // No metadata - likely created via checkout, will be handled by checkout.session.completed
  }

  // Cast to access properties
  const subscriptionData = subscription as any;

  // Convert Unix timestamps
  const currentPeriodStart = new Date(subscriptionData.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);

  // Check if already exists
  const existingSubscription = await subscriptionRepository.findByUserId(userId);

  if (existingSubscription) {
    // Cancel old subscription in Stripe if different
    if (
      existingSubscription.stripeSubscriptionId &&
      existingSubscription.stripeSubscriptionId !== subscription.id
    ) {
      try {
        const oldStripeSubscription = await stripe.subscriptions.retrieve(
          existingSubscription.stripeSubscriptionId
        );

        if (oldStripeSubscription.status === "active") {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
        }
      } catch (error: any) {
        // Old subscription might already be deleted, that's fine
      }
    }

    // Update existing record
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });
  } else {
    // Create new
    await subscriptionRepository.create({
      userId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
    });
  }
}

/**
 * Handle customer.subscription.updated
 * Update subscription details (plan changes, cancellations, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Convert Unix timestamps to Date
  const currentPeriodStart = new Date((subscription as any).current_period_start * 1000);
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  // Validate dates
  if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
    console.error("[Webhook] Invalid date conversion in subscription.updated");
    return;
  }

  // Find subscription by Stripe subscription ID
  const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
    subscription.id
  );

  if (!existingSubscription) {
    console.error("[Webhook] Cannot find subscription:", subscription.id);
    return;
  }

  // Map Stripe status to our status
  const status = mapStripeStatus(subscription.status);
  const subscriptionData = subscription as any;

  // Check if subscription is scheduled for cancellation
  // Either cancel_at_period_end is true OR cancel_at is set (future timestamp)
  const cancelAtPeriodEnd = Boolean(
    subscriptionData.cancel_at_period_end || subscriptionData.cancel_at
  );

  // Update subscription
  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  });
}

/**
 * Handle customer.subscription.deleted
 * Cancel subscription
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
    subscription.id
  );

  if (!existingSubscription) {
    console.error("[Webhook] Cannot find subscription to delete:", subscription.id);
    return;
  }

  // Mark subscription as canceled
  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status: SubscriptionStatus.CANCELED,
    cancelAtPeriodEnd: true,
  });
}

/**
 * Handle invoice.payment_succeeded
 * Confirm payment received (for recurring payments)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (!subscription) {
    console.error("[Webhook] Cannot find subscription for invoice:", invoice.id);
    return;
  }

  // Ensure subscription is active
  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
    });
  }
}

/**
 * Handle invoice.payment_failed
 * Lock user out of dashboard (per requirements: immediate lockout)
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (!subscription) {
    console.error("[Webhook] Cannot find subscription for failed invoice:", invoice.id);
    return;
  }

  // Mark subscription as past due (immediate lockout)
  await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
    status: SubscriptionStatus.PAST_DUE,
  });

  // TODO: Send email notification to user
  // TODO: Consider grace period vs. immediate lockout based on business requirements
}

/**
 * Map Stripe subscription status to our SubscriptionStatus enum
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "incomplete":
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}
