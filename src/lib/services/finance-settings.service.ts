import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { UpdateFinanceSettingsInput } from "@/lib/validation/finance-settings.schemas";
import {
  PAYMENT_FEE_DEFAULTS,
  resolvePaymentFeeRate,
  type PaymentFeeOverrides,
} from "@/config/payment-fees.config";
import type { ResolvedFinanceSettings } from "@/lib/finance/order-charges";

/** Resolved settings plus the fully materialized fee-rate table (defaults merged with overrides). */
export interface FinanceSettingsDto extends ResolvedFinanceSettings {
  storeId: string;
  taxLabel: string | null;
  feeRates: typeof PAYMENT_FEE_DEFAULTS;
}

function parseOverrides(json: Prisma.JsonValue | null): PaymentFeeOverrides | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json as PaymentFeeOverrides;
}

/**
 * Resolve a store's finance settings, merging the stored row (if any) with
 * config defaults. Never returns null — an unconfigured store behaves as
 * "no tax, no service charge, processing fee on with shipped defaults",
 * which matches the legacy hardcoded-zero-tax behavior for tax/service and
 * still gives an accurate-ish processing-fee estimate out of the box.
 */
export async function getFinanceSettings(storeId: string): Promise<FinanceSettingsDto> {
  const row = await prisma.storeFinanceSettings.findUnique({ where: { storeId } });

  const overrides = row ? parseOverrides(row.processingFeeOverrides) : null;

  const feeRates = { ...PAYMENT_FEE_DEFAULTS };
  for (const method of Object.keys(feeRates) as (keyof typeof PAYMENT_FEE_DEFAULTS)[]) {
    feeRates[method] = resolvePaymentFeeRate(method, overrides);
  }

  return {
    storeId,
    taxEnabled: row?.taxEnabled ?? false,
    taxRate: row ? Number(row.taxRate) : 0,
    taxLabel: row?.taxLabel ?? null,
    taxInclusive: row?.taxInclusive ?? true,
    serviceChargeEnabled: row?.serviceChargeEnabled ?? false,
    serviceChargeRate: row ? Number(row.serviceChargeRate) : 0,
    processingFeeEnabled: row?.processingFeeEnabled ?? true,
    processingFeeOverrides: overrides,
    feeRates,
  };
}

export async function updateFinanceSettings(
  storeId: string,
  input: UpdateFinanceSettingsInput
): Promise<FinanceSettingsDto> {
  await prisma.storeFinanceSettings.upsert({
    where: { storeId },
    create: {
      storeId,
      taxEnabled: input.taxEnabled ?? false,
      taxRate: input.taxRate ?? 0,
      taxLabel: input.taxLabel,
      taxInclusive: input.taxInclusive ?? true,
      serviceChargeEnabled: input.serviceChargeEnabled ?? false,
      serviceChargeRate: input.serviceChargeRate ?? 0,
      processingFeeEnabled: input.processingFeeEnabled ?? true,
      processingFeeOverrides: input.processingFeeOverrides ?? Prisma.JsonNull,
    },
    update: {
      ...(input.taxEnabled !== undefined && { taxEnabled: input.taxEnabled }),
      ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
      ...(input.taxLabel !== undefined && { taxLabel: input.taxLabel }),
      ...(input.taxInclusive !== undefined && { taxInclusive: input.taxInclusive }),
      ...(input.serviceChargeEnabled !== undefined && {
        serviceChargeEnabled: input.serviceChargeEnabled,
      }),
      ...(input.serviceChargeRate !== undefined && {
        serviceChargeRate: input.serviceChargeRate,
      }),
      ...(input.processingFeeEnabled !== undefined && {
        processingFeeEnabled: input.processingFeeEnabled,
      }),
      ...(input.processingFeeOverrides !== undefined && {
        processingFeeOverrides: input.processingFeeOverrides,
      }),
    },
  });

  return getFinanceSettings(storeId);
}

/** Thin resolved-settings accessor for order write paths (no feeRates materialization needed). */
export async function resolveFinanceSettingsForOrder(
  storeId: string
): Promise<ResolvedFinanceSettings> {
  const settings = await getFinanceSettings(storeId);
  return {
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    taxInclusive: settings.taxInclusive,
    serviceChargeEnabled: settings.serviceChargeEnabled,
    serviceChargeRate: settings.serviceChargeRate,
    processingFeeEnabled: settings.processingFeeEnabled,
    processingFeeOverrides: settings.processingFeeOverrides,
  };
}
