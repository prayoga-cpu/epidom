import { z } from "zod";

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
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

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
