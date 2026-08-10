import { z } from "zod";
import { PaymentMarket } from "@prisma/client";
import { currencySchema } from "./common.schemas";
import { paymentMethodEnum } from "./pos.schemas";
import { PAYMENT_METHOD_LABELS } from "@/config/payment-fees.config";

/**
 * Store-level fees & taxes settings validation
 */

// A percentage rate stored as a 0-1 fraction, up to 4 decimal places
// (0.0075 = 0.75%). Doesn't reuse `priceSchema` — its .multipleOf(0.01)
// would reject sub-percent rates like Xendit's QRIS 0.7%.
export const rateSchema = z
  .number()
  .min(0, "Rate must be non-negative")
  .max(1, "Rate must not exceed 100%")
  .multipleOf(0.0001, "Rate can only have up to 4 decimal places");

export const paymentFeeRateSchema = z.object({
  percent: rateSchema,
  flat: z.number().min(0, "Flat fee must be non-negative").max(1_000_000, "Flat fee is too large"),
});

export type PaymentFeeRateInput = z.infer<typeof paymentFeeRateSchema>;

// Partial — only methods the merchant explicitly overrode are present.
// Built from PAYMENT_METHOD_LABELS' keys (every PaymentMethod enum value)
// instead of a hand-maintained list, so a newly added payment method can't
// silently drift out of sync and get rejected by .strict() again.
export const paymentFeeOverridesSchema = z
  .object(
    Object.fromEntries(
      Object.keys(PAYMENT_METHOD_LABELS).map((method) => [method, paymentFeeRateSchema.optional()])
    ) as Record<keyof typeof PAYMENT_METHOD_LABELS, z.ZodOptional<typeof paymentFeeRateSchema>>
  )
  .strict();

export type PaymentFeeOverridesInput = z.infer<typeof paymentFeeOverridesSchema>;

const financeSettingsFieldsSchema = z.object({
  // Moved here from the old User.currency — see StoreFinanceSettings.currency
  // in schema.prisma for why this now lives per-store/per-business.
  currency: currencySchema.optional(),
  market: z.nativeEnum(PaymentMarket).optional(),
  // Which methods POS checkout actually offers. PAY_LATER is excluded — it
  // has its own dedicated payLaterEnabled toggle, never part of this list.
  enabledPaymentMethods: z.array(paymentMethodEnum.exclude(["PAY_LATER"])).optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: rateSchema.optional(),
  taxLabel: z.string().max(50, "Tax label is too long").optional(),
  taxInclusive: z.boolean().optional(),
  serviceChargeEnabled: z.boolean().optional(),
  serviceChargeRate: rateSchema.optional(),
  processingFeeEnabled: z.boolean().optional(),
  processingFeeOverrides: paymentFeeOverridesSchema.optional(),
});

function refineFinanceSettingsFields(
  data: z.infer<typeof financeSettingsFieldsSchema>,
  ctx: z.RefinementCtx
) {
  if (data.taxEnabled && !data.taxRate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["taxRate"],
      message: "Tax rate must be greater than 0 when tax is enabled",
    });
  }
  if (data.serviceChargeEnabled && !data.serviceChargeRate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serviceChargeRate"],
      message: "Service charge rate must be greater than 0 when enabled",
    });
  }
}

// Business-level (shared/profile-wide) settings — no sync flag, since a
// Business is the sync *target*, not something that can itself sync.
export const updateFinanceSettingsSchema =
  financeSettingsFieldsSchema.superRefine(refineFinanceSettingsFields);

export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;

// Store-level settings — adds the toggle for following the Business's shared
// settings instead of this store's own row, plus payLaterEnabled, which lives
// directly on Store (not synced with the business — a chain may want tabs
// allowed at one outlet but not another).
export const updateStoreFinanceSettingsSchema = financeSettingsFieldsSchema
  .extend({
    syncFinanceWithBusiness: z.boolean().optional(),
    payLaterEnabled: z.boolean().optional(),
  })
  .superRefine(refineFinanceSettingsFields);

export type UpdateStoreFinanceSettingsInput = z.infer<typeof updateStoreFinanceSettingsSchema>;
