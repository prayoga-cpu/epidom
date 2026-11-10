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
import { handleApiError } from "@/lib/utils/api-error-handler";
import { AppError } from "@/lib/errors";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import Stripe from "stripe";
import { sendSubscriptionReceipt } from "@/lib/services/subscription-receipt.service";
import { recordInvoiceCommission, recordRefund } from "@/lib/services/partner-commission.service";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionCreated,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  handleTrialWillEnd,
} from "@/lib/services/stripe-subscription-sync.service";

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
  } catch {
    // Signature verification failed. A 400 (not the generic 500) so a wrong
    // STRIPE_WEBHOOK_SECRET shows in Stripe as a rejected delivery, not a server error.
    return handleApiError(
      new AppError("Invalid Stripe signature", ApiErrorCode.VALIDATION_ERROR, 400),
      {
        endpoint: "POST /api/webhooks/stripe",
        context: { step: "signature_verification" },
      }
    );
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
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        // After the status recovery: a failure here makes Stripe retry the
        // event, and both steps are safe to repeat.
        await recordInvoiceCommission((event.data.object as Stripe.Invoice).id!);
        // The owner's receipt by email (never throws, once per invoice).
        await sendSubscriptionReceipt(event.data.object as Stripe.Invoice);
        break;
      case "refund.created":
      case "refund.updated":
        await recordRefund((event.data.object as Stripe.Refund).id);
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
