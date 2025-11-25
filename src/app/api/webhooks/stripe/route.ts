import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { subscriptionRepository } from "@/lib/repositories";
import { subscriptionService } from "@/lib/services";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import {
  extractSubscriptionPeriod,
  isSubscriptionCanceling,
  isInvoiceWithSubscription,
} from "@/types/stripe";

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
    return NextResponse.json(createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "No signature"), {
      status: 400,
    });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/webhooks/stripe",
      context: { step: "signature_verification" },
    });
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
    }

    return NextResponse.json(createSuccessResponse({ received: true }));
  } catch (error) {
    return handleApiError(error, {
      endpoint: "POST /api/webhooks/stripe",
      context: { step: "event_handling", eventType: event.type },
    });
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
    return;
  }

  // Get subscription from Stripe with expanded details
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice", "customer"],
  });

  // Extract period dates using type-safe helper
  const period = extractSubscriptionPeriod(stripeSubscription);
  if (!period) {
    return; // Invalid period data, let subscription.created handle it
  }

  const { currentPeriodStart, currentPeriodEnd } = period;

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
        } else {
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

  // Invalidate cache
  subscriptionService.invalidateUserCache(userId);

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
    return;
  }

  // Extract period dates using type-safe helper
  const period = extractSubscriptionPeriod(subscription);
  if (!period) {
    return; // Invalid period data
  }

  const { currentPeriodStart, currentPeriodEnd } = period;

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
      } catch (error: any) {}
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

  // Invalidate cache
  subscriptionService.invalidateUserCache(userId);
}

/**
 * Handle customer.subscription.updated
 * Update subscription details (plan changes, cancellations, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Extract period dates using type-safe helper
  const period = extractSubscriptionPeriod(subscription);
  if (!period) {
    return; // Invalid period data
  }

  const { currentPeriodStart, currentPeriodEnd } = period;

  // Find subscription by Stripe subscription ID
  const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
    subscription.id
  );

  if (!existingSubscription) {
    return;
  }

  // Map Stripe status to our status
  const status = mapStripeStatus(subscription.status);

  // Check if subscription is scheduled for cancellation using type-safe helper
  const cancelAtPeriodEnd = isSubscriptionCanceling(subscription);
  // Update subscription
  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  });

  // Invalidate cache
  subscriptionService.invalidateUserCache(existingSubscription.userId);
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
    return;
  }

  // Mark subscription as canceled
  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status: SubscriptionStatus.CANCELED,
    cancelAtPeriodEnd: true,
  });

  // Invalidate cache
  subscriptionService.invalidateUserCache(existingSubscription.userId);
}

/**
 * Handle invoice.payment_succeeded
 * Confirm payment received (for recurring payments)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Use type guard to safely extract subscription ID
  if (!isInvoiceWithSubscription(invoice) || !invoice.subscription) {
    return; // Not a subscription invoice
  }

  const subscriptionId = invoice.subscription;

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (!subscription) {
    return;
  }

  // Ensure subscription is active
  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
    });
    // Invalidate cache
    subscriptionService.invalidateUserCache(subscription.userId);
  }
}

/**
 * Handle invoice.payment_failed
 * Lock user out of dashboard (per requirements: immediate lockout)
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Use type guard to safely extract subscription ID
  if (!isInvoiceWithSubscription(invoice) || !invoice.subscription) {
    return; // Not a subscription invoice
  }

  const subscriptionId = invoice.subscription;

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (!subscription) {
    return;
  }

  // Mark subscription as past due (immediate lockout)
  await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
    status: SubscriptionStatus.PAST_DUE,
  });
  // Invalidate cache
  subscriptionService.invalidateUserCache(subscription.userId);
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
