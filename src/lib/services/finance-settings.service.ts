import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  UpdateFinanceSettingsInput,
  UpdateStoreFinanceSettingsInput,
} from "@/lib/validation/finance-settings.schemas";
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
  /** True when this store's settings are inherited from BusinessFinanceSettings. */
  syncFinanceWithBusiness: boolean;
  /** Owner-only toggle for the "Pay Later" checkout option — always store-specific, never synced. */
  payLaterEnabled: boolean;
}

export interface BusinessFinanceSettingsDto extends ResolvedFinanceSettings {
  businessId: string;
  taxLabel: string | null;
  feeRates: typeof PAYMENT_FEE_DEFAULTS;
}

interface FinanceSettingsRow {
  taxEnabled: boolean;
  taxRate: Prisma.Decimal;
  taxLabel: string | null;
  taxInclusive: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: Prisma.Decimal;
  processingFeeEnabled: boolean;
  processingFeeOverrides: Prisma.JsonValue | null;
}

function parseOverrides(json: Prisma.JsonValue | null): PaymentFeeOverrides | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json as PaymentFeeOverrides;
}

function buildFeeRates(overrides: PaymentFeeOverrides | null): typeof PAYMENT_FEE_DEFAULTS {
  const feeRates = { ...PAYMENT_FEE_DEFAULTS };
  for (const method of Object.keys(feeRates) as (keyof typeof PAYMENT_FEE_DEFAULTS)[]) {
    feeRates[method] = resolvePaymentFeeRate(method, overrides);
  }
  return feeRates;
}

function resolveRow(row: FinanceSettingsRow | null) {
  const overrides = row ? parseOverrides(row.processingFeeOverrides) : null;
  return {
    taxEnabled: row?.taxEnabled ?? false,
    taxRate: row ? Number(row.taxRate) : 0,
    taxLabel: row?.taxLabel ?? null,
    taxInclusive: row?.taxInclusive ?? true,
    serviceChargeEnabled: row?.serviceChargeEnabled ?? false,
    serviceChargeRate: row ? Number(row.serviceChargeRate) : 0,
    processingFeeEnabled: row?.processingFeeEnabled ?? true,
    processingFeeOverrides: overrides,
    feeRates: buildFeeRates(overrides),
  };
}

function buildCreateData(input: UpdateFinanceSettingsInput) {
  return {
    taxEnabled: input.taxEnabled ?? false,
    taxRate: input.taxRate ?? 0,
    taxLabel: input.taxLabel,
    taxInclusive: input.taxInclusive ?? true,
    serviceChargeEnabled: input.serviceChargeEnabled ?? false,
    serviceChargeRate: input.serviceChargeRate ?? 0,
    processingFeeEnabled: input.processingFeeEnabled ?? true,
    processingFeeOverrides: input.processingFeeOverrides ?? Prisma.JsonNull,
  };
}

function buildUpdateData(input: UpdateFinanceSettingsInput) {
  return {
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
  };
}

/**
 * Resolve a store's finance settings. If the store is synced to its Business's
 * shared settings, those are resolved instead of the store's own row — merging
 * config defaults either way, so this never returns null (an unconfigured
 * store/business behaves as "no tax, no service charge, processing fee on with
 * shipped defaults").
 */
export async function getFinanceSettings(storeId: string): Promise<FinanceSettingsDto> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      businessId: true,
      syncFinanceWithBusiness: true,
      payLaterEnabled: true,
      financeSettings: true,
    },
  });
  if (!store) {
    throw new Error("Store not found");
  }

  if (store.syncFinanceWithBusiness) {
    const { businessId: _businessId, ...resolved } = await getBusinessFinanceSettings(
      store.businessId
    );
    return {
      ...resolved,
      storeId,
      syncFinanceWithBusiness: true,
      payLaterEnabled: store.payLaterEnabled,
    };
  }

  return {
    ...resolveRow(store.financeSettings),
    storeId,
    syncFinanceWithBusiness: false,
    payLaterEnabled: store.payLaterEnabled,
  };
}

export async function updateFinanceSettings(
  storeId: string,
  input: UpdateStoreFinanceSettingsInput
): Promise<FinanceSettingsDto> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { syncFinanceWithBusiness: true },
  });
  if (!store) {
    throw new Error("Store not found");
  }

  // payLaterEnabled lives on Store like syncFinanceWithBusiness, but isn't
  // part of the tax/fee config that sync mode locks — it's independently
  // settable regardless of sync state, so it's pulled out before the
  // hasFieldUpdates/sync-conflict check below.
  const { syncFinanceWithBusiness, payLaterEnabled, ...fields } = input;
  const hasFieldUpdates = Object.keys(fields).length > 0;
  const willBeSynced = syncFinanceWithBusiness ?? store.syncFinanceWithBusiness;

  if (willBeSynced && hasFieldUpdates) {
    throw new Error(
      "This store follows the shared business settings — unsync it first, or edit the shared settings instead."
    );
  }

  if (syncFinanceWithBusiness !== undefined || payLaterEnabled !== undefined) {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(syncFinanceWithBusiness !== undefined && { syncFinanceWithBusiness }),
        ...(payLaterEnabled !== undefined && { payLaterEnabled }),
      },
    });
  }

  if (!willBeSynced && hasFieldUpdates) {
    await prisma.storeFinanceSettings.upsert({
      where: { storeId },
      create: { storeId, ...buildCreateData(fields) },
      update: buildUpdateData(fields),
    });
  }

  return getFinanceSettings(storeId);
}

/** Resolve a Business's shared finance settings (the sync target for its Stores). */
export async function getBusinessFinanceSettings(
  businessId: string
): Promise<BusinessFinanceSettingsDto> {
  const row = await prisma.businessFinanceSettings.findUnique({ where: { businessId } });
  return { ...resolveRow(row), businessId };
}

export async function updateBusinessFinanceSettings(
  businessId: string,
  input: UpdateFinanceSettingsInput
): Promise<BusinessFinanceSettingsDto> {
  await prisma.businessFinanceSettings.upsert({
    where: { businessId },
    create: { businessId, ...buildCreateData(input) },
    update: buildUpdateData(input),
  });

  return getBusinessFinanceSettings(businessId);
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
