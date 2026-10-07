import { z } from "zod";
import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * Subscription Checkout Schema
 */
export const checkoutSchema = z.object({
  plan: z.enum(["POS", "OPERATIONS"], {
    required_error: "Plan is required",
    invalid_type_error: "Plan must be either POS or OPERATIONS",
  }),
  successUrl: z.string().url("Invalid success URL").optional(),
  cancelUrl: z.string().url("Invalid cancel URL").optional(),
  trial: z.boolean().optional(),
  yearly: z.boolean().optional().default(false),
  // The currency the page quoted the price in. Every catalog Price has an exact
  // EUR, USD and IDR amount, so this picks which one Stripe charges. Left out,
  // Stripe picks from the visitor's IP instead.
  currency: z.enum(["EUR", "USD", "IDR"]).optional(),
  // Where the default success and cancel pages lead on to (the setup wizard
  // passes the new store's dashboard). An app path only, never another site.
  next: z
    .string()
    .max(512)
    .refine((value) => safeInternalPath(value) !== null, "Must be an app path")
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Custom-price Checkout Schema.
 *
 * No plan/amount here on purpose — both come from the pending offer stored on
 * the subscription, so a client can't pick its own price. Both URLs accept an
 * absolute URL or an app-relative path.
 */
const redirectUrl = z
  .string()
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Must be a URL or an absolute path");

export const customPriceCheckoutSchema = z.object({
  successUrl: redirectUrl.optional(),
  cancelUrl: redirectUrl.optional(),
});

export type CustomPriceCheckoutInput = z.infer<typeof customPriceCheckoutSchema>;

/**
 * Customer Portal Schema
 */
export const portalSchema = z.object({
  returnUrl: z.string().url("Invalid return URL").optional(),
});

export type PortalInput = z.infer<typeof portalSchema>;

/**
 * BETA / privilege freestyle plan switch.
 * Only admin-granted (non-payment) accounts may use this — any plan, no checkout.
 */
export const betaPlanSchema = z.object({
  plan: z.enum(["FREE", "POS", "OPERATIONS", "ENTERPRISE"], {
    required_error: "Plan is required",
  }),
});

export type BetaPlanInput = z.infer<typeof betaPlanSchema>;

/**
 * Setup Intent Schema (Card Validation)
 */
export const setupSchema = z.object({
  successUrl: z.string().url("Invalid success URL").optional(),
  cancelUrl: z.string().url("Invalid cancel URL").optional(),
});

export type SetupInput = z.infer<typeof setupSchema>;
