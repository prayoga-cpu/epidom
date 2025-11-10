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

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
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
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
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

  // Get or retrieve subscription from Stripe
  const subscriptionId = session.subscription as string;
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update subscription in database
  const existingSubscription = await subscriptionRepository.findByUserId(userId);

  if (existingSubscription) {
    await subscriptionRepository.update(userId, {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: false,
    });
  } else {
    await subscriptionRepository.create({
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      plan: plan as SubscriptionPlan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
    });
  }

  console.log(`[Webhook] Subscription activated for user ${userId}, plan: ${plan}`);

  // Note: The 80/20 split transfer happens automatically via Stripe
  // - Platform (developer) receives 20% as application fee
  // - Epidom owner receives 80% via transfer_data.destination
  // No manual transfer needed here!
}

/**
 * Handle customer.subscription.updated
 * Update subscription details (plan changes, cancellations, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find subscription by Stripe subscription ID
    const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
      subscription.id
    );
    if (!existingSubscription) {
      console.error("[Webhook] Cannot find user for subscription:", subscription.id);
      return;
    }

    await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    });

    console.log(
      `[Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`
    );
    return;
  }

  // Update subscription in database
  await subscriptionRepository.update(userId, {
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  });

  console.log(`[Webhook] Subscription updated for user ${userId}, status: ${subscription.status}`);
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
  await subscriptionRepository.update(existingSubscription.userId, {
    status: SubscriptionStatus.CANCELED,
    cancelAtPeriodEnd: true,
  });

  console.log(`[Webhook] Subscription canceled: ${subscription.id}`);
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
    await subscriptionRepository.update(subscription.userId, {
      status: SubscriptionStatus.ACTIVE,
    });
  }

  console.log(`[Webhook] Payment succeeded for subscription: ${subscriptionId}`);
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
  await subscriptionRepository.update(subscription.userId, {
    status: SubscriptionStatus.PAST_DUE,
  });

  console.log(`[Webhook] Payment failed for subscription: ${subscriptionId}, user locked out`);

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
