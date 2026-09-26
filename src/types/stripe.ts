/**
 * Stripe object helpers that work across API versions.
 *
 * Stripe API 2025-03-31.basil moved two things this app reads, and every later
 * version (clover, dahlia) keeps them where basil put them:
 *  - a subscription's billing period: top-level `current_period_start/end` →
 *    each subscription item's `current_period_start/end`;
 *  - an invoice's subscription: top-level `invoice.subscription` →
 *    `invoice.parent.subscription_details.subscription`.
 *
 * Webhook payloads are rendered in the endpoint's API version, while SDK
 * responses use the version pinned in `src/lib/stripe.ts`, so the helpers read
 * the current location first and fall back to the pre-basil one.
 */

import Stripe from "stripe";

/** Pre-basil subscription fields, still present on objects from older API versions. */
interface LegacySubscriptionPeriod {
  current_period_start?: number;
  current_period_end?: number;
}

/** Pre-basil invoice field, still present on objects from older API versions. */
interface LegacyInvoiceSubscription {
  subscription?: string | Stripe.Subscription | null;
}

function toDate(unixSeconds: unknown): Date | null {
  if (typeof unixSeconds !== "number") return null;
  const date = new Date(unixSeconds * 1000);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Safely extract period dates from a Stripe Subscription.
 * Reads the first subscription item's period (basil and later), falling back
 * to the top-level fields of older API versions. Returns null when neither has
 * a valid period.
 */
export function extractSubscriptionPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} | null {
  const item = subscription.items?.data?.[0];
  const legacy = subscription as Stripe.Subscription & LegacySubscriptionPeriod;

  const currentPeriodStart =
    toDate(item?.current_period_start) ?? toDate(legacy.current_period_start);
  const currentPeriodEnd = toDate(item?.current_period_end) ?? toDate(legacy.current_period_end);

  if (!currentPeriodStart || !currentPeriodEnd) {
    return null;
  }

  return { currentPeriodStart, currentPeriodEnd };
}

/**
 * Check if subscription is scheduled for cancellation.
 * `cancel_at_period_end` and `cancel_at` are top-level in every API version.
 */
export function isSubscriptionCanceling(subscription: Stripe.Subscription): boolean {
  return Boolean(subscription.cancel_at_period_end || subscription.cancel_at);
}

/**
 * The ID of the subscription that generated an invoice, or null for a
 * one-off invoice. Reads `parent.subscription_details.subscription` (basil and
 * later), then a line item's `parent.subscription_item_details.subscription`,
 * falling back to the top-level `subscription` of older API versions.
 * Handles both the ID string and an expanded Subscription object.
 */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = invoice as Stripe.Invoice & LegacyInvoiceSubscription;
  const fromLines = invoice.lines?.data?.find(
    (line) => line.parent?.subscription_item_details?.subscription
  )?.parent?.subscription_item_details?.subscription;

  const ref =
    invoice.parent?.subscription_details?.subscription ?? fromLines ?? legacy.subscription ?? null;

  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
