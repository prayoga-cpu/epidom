import { z } from "zod";

/**
 * Loyalty-points settings (one row per store).
 *
 * `spendPerPoint` and `pointValue` are LITERAL amounts in the store's display
 * currency — never IDR-converted — which is why the form shows the store's own
 * currency symbol and why the defaults differ per currency (see the Promotions
 * tab). The columns are Decimal(12,2) / Decimal(12,4).
 */

export const MAX_LOYALTY_AMOUNT = 99_999_999;

/**
 * PUT body. Every field is optional so the "enabled" switch alone can be
 * toggled once the amounts are stored; the SERVICE merges the body over the
 * stored settings and enforces the enable rule on the merged result (a partial
 * body cannot evaluate it on its own) via `loyaltyEnableError`.
 */
export const updateLoyaltySettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    spendPerPoint: z
      .number()
      .finite()
      .min(0, "Can't be negative")
      .max(MAX_LOYALTY_AMOUNT, "Value is too large")
      .multipleOf(0.01, "At most 2 decimal places")
      .optional(),
    pointValue: z
      .number()
      .finite()
      .min(0, "Can't be negative")
      .max(MAX_LOYALTY_AMOUNT, "Value is too large")
      .multipleOf(0.0001, "At most 4 decimal places")
      .optional(),
    minRedeemPoints: z
      .number()
      .int("Whole number")
      .min(0, "Can't be negative")
      .max(1_000_000, "Value is too large")
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateLoyaltySettingsInput = z.infer<typeof updateLoyaltySettingsSchema>;

/**
 * Why loyalty can't be switched on with these numbers, or null when it can.
 * A zero spend-per-point would divide by zero in pointsEarnedFor, and a zero
 * point value would let a customer "redeem" points for a discount of nothing —
 * so both must be positive before the program can run.
 */
export function loyaltyEnableError(s: {
  spendPerPoint: number;
  pointValue: number;
}): { field: "spendPerPoint" | "pointValue"; message: string } | null {
  if (!(s.spendPerPoint > 0)) {
    return { field: "spendPerPoint", message: "Set how much a customer spends to earn 1 point" };
  }
  if (!(s.pointValue > 0)) {
    return { field: "pointValue", message: "Set what 1 point is worth when redeemed" };
  }
  return null;
}
