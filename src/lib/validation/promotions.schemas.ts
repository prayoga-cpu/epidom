import { z } from "zod";

/**
 * Discount presets and coupons.
 *
 * Every amount is LITERAL in the store's display currency — a FIXED 5 in a EUR
 * store is 5 EUR, never IDR-converted (see src/lib/finance/discounts.ts). That
 * is why the bound below is a plain ceiling, not a currency-aware one: Decimal(10,2)
 * on the column is what actually caps it.
 */

export const discountKindSchema = z.enum(["PERCENT", "FIXED"]);

/** Ceiling for a FIXED amount / minimum subtotal — a typo guard under Decimal(10,2). */
export const MAX_PROMO_AMOUNT = 99_999_999;

/** PERCENT: 0 < v <= 100. FIXED: 0 < v <= MAX_PROMO_AMOUNT. */
export function discountValueError(type: "PERCENT" | "FIXED", value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return "Value must be greater than zero";
  if (type === "PERCENT" && value > 100) return "A percentage can't exceed 100";
  if (type === "FIXED" && value > MAX_PROMO_AMOUNT) return "Value is too large";
  return null;
}

const money2 = z
  .number()
  .finite("Value must be a number")
  .multipleOf(0.01, "At most 2 decimal places");

const valueField = money2.positive("Value must be greater than zero");

const presetName = z.string().trim().min(1, "Name is required").max(60, "Name is too long");

export const upsertDiscountPresetSchema = z
  .object({
    name: presetName,
    type: discountKindSchema,
    value: valueField,
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .superRefine((v, ctx) => {
    const problem = discountValueError(v.type, v.value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: problem });
  });

export type UpsertDiscountPresetInput = z.infer<typeof upsertDiscountPresetSchema>;

/**
 * PATCH body. `value` is only cross-checked against `type` when both arrive;
 * when just one does, the service checks it against the stored row (a partial
 * body cannot evaluate the rule on its own).
 */
export const updateDiscountPresetSchema = z
  .object({
    name: presetName.optional(),
    type: discountKindSchema.optional(),
    value: valueField.optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
  .superRefine((v, ctx) => {
    if (v.type && v.value !== undefined) {
      const problem = discountValueError(v.type, v.value);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: problem });
    }
  });

export type UpdateDiscountPresetInput = z.infer<typeof updateDiscountPresetSchema>;

// ─── Coupons ─────────────────────────────────────────────────────────────────

/** Stored uppercase; the cashier may type it in any case. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{2,32}$/;

export const couponCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => COUPON_CODE_PATTERN.test(v), "Use 2-32 letters, digits, dashes or underscores");

const isoDate = z
  .string()
  .datetime({ offset: true, message: "Invalid date" })
  .transform((v) => new Date(v));

// Optional + nullable: null (or "") clears the bound on PATCH, absent leaves it.
const optionalDate = z
  .union([isoDate, z.literal(""), z.null()])
  .transform((v) => (v === "" ? null : v))
  .optional();

const minSubtotalField = z
  .union([money2.min(0, "Can't be negative").max(MAX_PROMO_AMOUNT, "Value is too large"), z.null()])
  .optional();

const maxUsesField = z
  .union([z.number().int("Whole number").min(1, "At least 1").max(1_000_000), z.null()])
  .optional();

const couponName = z
  .union([z.string().trim().max(80, "Name is too long"), z.null()])
  .transform((v) => (v === "" ? null : v))
  .optional();

function checkWindow(
  v: { validFrom?: Date | null; validUntil?: Date | null },
  ctx: z.RefinementCtx
) {
  if (v.validFrom && v.validUntil && v.validUntil <= v.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: "The end date must be after the start date",
    });
  }
}

export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    name: couponName,
    type: discountKindSchema,
    value: valueField,
    minSubtotal: minSubtotalField,
    maxUses: maxUsesField,
    validFrom: optionalDate,
    validUntil: optionalDate,
    isActive: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const problem = discountValueError(v.type, v.value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: problem });
    checkWindow(v, ctx);
  });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;

/**
 * `code` is immutable once orders can reference the coupon, so a body that
 * carries one is rejected outright (`.strict()`) instead of being silently
 * dropped — a caller who thinks it renamed the code should be told it didn't.
 */
export const updateCouponSchema = z
  .object({
    name: couponName,
    type: discountKindSchema.optional(),
    value: valueField.optional(),
    minSubtotal: minSubtotalField,
    maxUses: maxUsesField,
    validFrom: optionalDate,
    validUntil: optionalDate,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
  .superRefine((v, ctx) => {
    if (v.type && v.value !== undefined) {
      const problem = discountValueError(v.type, v.value);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: problem });
    }
    checkWindow(v, ctx);
  });

export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

/**
 * Lenient on the code on purpose: /coupons/validate ALWAYS answers 200 with
 * `valid:false`, so a mistyped code ("@@") must come back as NOT_FOUND, not as
 * a 400 the cart would have to special-case.
 */
export const validateCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a code")
    .max(64, "Code is too long")
    .transform((v) => v.toUpperCase()),
  itemsTotal: z.number().finite().min(0),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export const presetListQuerySchema = z.object({
  includeInactive: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});
