/**
 * @file api/webhooks/stripe/route.ts
 * @description Stripe Webhook Handler
 * Critical endpoint that listens to Stripe events to manage subscription lifecycle.
 *
 * NOTE: This endpoint does NOT use withApiHandler because it requires raw body access
 * for signature verification, which wraps standard JSON parsing.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { subscriptionRepository } from "@/lib/repositories";
import { subscriptionService } from "@/lib/services";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import {
  extractSubscriptionPeriod,
  isSubscriptionCanceling,
  isInvoiceWithSubscription,
} from "@/types/stripe";
import Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events securely.
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
    // Signature verification failed
    return handleApiError(error, {
      endpoint: "POST /api/webhooks/stripe",
      context: { step: "signature_verification" },
    });
  }

  try {
    // Event Dispatcher
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
        // Ignore unhandled events
        break;
    }

    return NextResponse.json(createSuccessResponse({ received: true }));
  } catch (error) {
    // Business logic handling failed
    return handleApiError(error, {
      endpoint: "POST /api/webhooks/stripe",
      context: { step: "event_handling", eventType: event.type },
    });
  }
}

// ----------------------------------------------------------------------
// Event Handlers
// ----------------------------------------------------------------------

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as "FREE" | "FREE" | "POS" | "OPERATIONS" | undefined;
  const promotion = session.metadata?.promotion;

  if (!userId) return;

  // SETUP MODE: Card validation for free promo
  if (session.mode === "setup" && promotion === "new_year_2025") {
    const promoEndDate = new Date(process.env.PROMO_END_DATE || "2026-12-31T23:59:59Z");
    const now = new Date();

    const existingSubscription = await subscriptionRepository.findByUserId(userId);

    const subscriptionData = {
      plan: SubscriptionPlan.POS,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: promoEndDate,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      stripePriceId: null,
    };

    if (existingSubscription) {
      await subscriptionRepository.update(userId, subscriptionData);
    } else {
      await subscriptionRepository.create({
        userId,
        stripeCustomerId: session.customer as string,
        ...subscriptionData,
      });
    }

    subscriptionService.invalidateUserCache(userId);
    return;
  }

  // SUBSCRIPTION MODE
  if (!plan) return;

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice", "customer"],
  });

  const period = extractSubscriptionPeriod(stripeSubscription);
  if (!period) return;

  const { currentPeriodStart, currentPeriodEnd } = period;
  const existingSubscription = await subscriptionRepository.findByUserId(userId);

  if (existingSubscription) {
    // Verify cleanup of old subscription
    if (
      existingSubscription.stripeSubscriptionId &&
      existingSubscription.stripeSubscriptionId !== subscriptionId
    ) {
      try {
        const oldSub = await stripe.subscriptions.retrieve(
          existingSubscription.stripeSubscriptionId
        );
        if (oldSub.status === "active") {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
        }
      } catch (e) {
        /* Ignore if already deleted */
      }
    }

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

  subscriptionService.invalidateUserCache(userId);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan as "FREE" | "FREE" | "POS" | "OPERATIONS";

  if (!userId || !plan) return;

  const period = extractSubscriptionPeriod(subscription);
  if (!period) return;

  const { currentPeriodStart, currentPeriodEnd } = period;
  const existingSubscription = await subscriptionRepository.findByUserId(userId);

  if (existingSubscription) {
    // Cleanup logic similar to checkout handler...
    if (
      existingSubscription.stripeSubscriptionId &&
      existingSubscription.stripeSubscriptionId !== subscription.id
    ) {
      try {
        const oldSub = await stripe.subscriptions.retrieve(
          existingSubscription.stripeSubscriptionId
        );
        if (oldSub.status === "active") {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
        }
      } catch (e) {}
    }

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

  subscriptionService.invalidateUserCache(userId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const period = extractSubscriptionPeriod(subscription);
  if (!period) return;

  const { currentPeriodStart, currentPeriodEnd } = period;
  const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
    subscription.id
  );
  if (!existingSubscription) return;

  const status = mapStripeStatus(subscription.status);
  const cancelAtPeriodEnd = isSubscriptionCanceling(subscription);

  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  });

  subscriptionService.invalidateUserCache(existingSubscription.userId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(
    subscription.id
  );
  if (!existingSubscription) return;

  await subscriptionRepository.updateByStripeSubscriptionId(subscription.id, {
    status: SubscriptionStatus.CANCELED,
    cancelAtPeriodEnd: true,
  });

  subscriptionService.invalidateUserCache(existingSubscription.userId);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!isInvoiceWithSubscription(invoice) || !invoice.subscription) return;

  const subscriptionId = invoice.subscription;
  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
  if (!subscription) return;

  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
    });
    subscriptionService.invalidateUserCache(subscription.userId);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!isInvoiceWithSubscription(invoice) || !invoice.subscription) return;

  const subscriptionId = invoice.subscription;
  const subscription = await subscriptionRepository.findByStripeSubscriptionId(subscriptionId);
  if (!subscription) return;

  await subscriptionRepository.updateByStripeSubscriptionId(subscriptionId, {
    status: SubscriptionStatus.PAST_DUE,
  });

  subscriptionService.invalidateUserCache(subscription.userId);
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}
