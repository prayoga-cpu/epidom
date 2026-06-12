import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Server-side Stripe client
 * Used for backend operations like creating checkout sessions, transfers, etc.
 * Uses lazy initialization to prevent app crash on startup if the key is missing.
 */
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-10-29.clover" as any,
        typescript: true,
      });
    }
    return (_stripe as any)[prop];
  },
});
