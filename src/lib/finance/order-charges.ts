import type { PaymentMethod } from "@prisma/client";
import {
  computeProcessingFee,
  resolvePaymentFeeRate,
  type PaymentFeeOverrides,
} from "@/config/payment-fees.config";

/**
 * Pure order-charges calculator. No Prisma import — safe to reuse for a
 * client-side cart preview (POS/storefront) as well as the server write
 * paths, so the number the customer sees and the number that gets persisted
 * are guaranteed to match.
 */

export interface ResolvedFinanceSettings {
  taxEnabled: boolean;
  taxRate: number; // 0-1 fraction
  taxInclusive: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number; // 0-1 fraction
  processingFeeEnabled: boolean;
  processingFeeOverrides: PaymentFeeOverrides | null;
}

export interface OrderChargesInput {
  /** Sum of order item totals, before service charge/tax. */
  itemsTotal: number;
  delivery?: number;
  paymentMethod: PaymentMethod;
  settings: ResolvedFinanceSettings;
}

export interface OrderCharges {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
  processingFee: number;
  taxRate: number;
  serviceChargeRate: number;
  processingFeeRate: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeOrderCharges({
  itemsTotal,
  delivery = 0,
  paymentMethod,
  settings,
}: OrderChargesInput): OrderCharges {
  const scRate = settings.serviceChargeEnabled ? settings.serviceChargeRate : 0;
  const taxRate = settings.taxEnabled ? settings.taxRate : 0;

  let subtotal: number;
  let serviceCharge: number;
  let tax: number;
  let total: number;

  if (settings.taxInclusive) {
    // itemsTotal (the price already shown to the customer) is treated as
    // gross — already including service charge + tax — so we back those
    // components out rather than adding them on top. The customer's total
    // never changes when tax/service-charge are turned on in this mode.
    const divisor = (1 + scRate) * (1 + taxRate);
    subtotal = divisor > 0 ? round2(itemsTotal / divisor) : round2(itemsTotal);
    serviceCharge = round2(subtotal * scRate);
    // tax is the remainder (not independently rounded) so the components
    // always sum back to itemsTotal exactly, with no rounding drift.
    tax = round2(itemsTotal - subtotal - serviceCharge);
    total = round2(itemsTotal + delivery);
  } else {
    // Added on top of the item prices already shown to the customer.
    subtotal = round2(itemsTotal);
    serviceCharge = round2(subtotal * scRate);
    tax = round2((subtotal + serviceCharge) * taxRate);
    total = round2(subtotal + serviceCharge + tax + delivery);
  }

  const processingFee = settings.processingFeeEnabled
    ? computeProcessingFee(total, paymentMethod, settings.processingFeeOverrides)
    : 0;
  const processingFeeRate = settings.processingFeeEnabled
    ? resolvePaymentFeeRate(paymentMethod, settings.processingFeeOverrides).percent
    : 0;

  return {
    subtotal,
    serviceCharge,
    tax,
    total,
    processingFee,
    taxRate,
    serviceChargeRate: scRate,
    processingFeeRate,
  };
}
