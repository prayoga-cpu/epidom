/**
 * Extended Stripe types for better type safety
 * These types extend the official Stripe types with commonly used properties
 */

import Stripe from "stripe";

/**
 * Stripe Subscription with period timestamps
 * Extends the official Stripe.Subscription type with current_period_start and current_period_end
 */
export interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
}

/**
 * Stripe Invoice with subscription ID
 * Extends the official Stripe.Invoice type to ensure subscription is a string
 */
export interface StripeInvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | null;
}

/**
 * Type guard to check if a Stripe Subscription has period information
 */
export function isSubscriptionWithPeriod(
  subscription: Stripe.Subscription
): subscription is StripeSubscriptionWithPeriod {
  return (
    typeof (subscription as any).current_period_start === "number" &&
    typeof (subscription as any).current_period_end === "number"
  );
}

/**
 * Type guard to check if a Stripe Invoice has a subscription ID
 */
export function isInvoiceWithSubscription(
  invoice: Stripe.Invoice
): invoice is StripeInvoiceWithSubscription {
  return typeof (invoice as any).subscription === "string";
}

/**
 * Safely extract period dates from Stripe Subscription
 * Returns null if the subscription doesn't have valid period information
 */
export function extractSubscriptionPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} | null {
  if (!isSubscriptionWithPeriod(subscription)) {
    return null;
  }

  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Validate dates
  if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
    return null;
  }

  return { currentPeriodStart, currentPeriodEnd };
}

/**
 * Check if subscription is scheduled for cancellation
 */
export function isSubscriptionCanceling(subscription: Stripe.Subscription): boolean {
  if (!isSubscriptionWithPeriod(subscription)) {
    return false;
  }
  return Boolean(subscription.cancel_at_period_end || subscription.cancel_at);
}
