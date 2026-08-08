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
  /** Flat discount off itemsTotal, applied before service charge/tax. */
  discountAmount?: number;
  delivery?: number;
  paymentMethod: PaymentMethod;
  settings: ResolvedFinanceSettings;
}

export interface OrderCharges {
  subtotal: number;
  discountAmount: number;
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
  discountAmount = 0,
  delivery = 0,
  paymentMethod,
  settings,
}: OrderChargesInput): OrderCharges {
  const scRate = settings.serviceChargeEnabled ? settings.serviceChargeRate : 0;
  const taxRate = settings.taxEnabled ? settings.taxRate : 0;

  // Clamped so a discount can never exceed the items it's applied to (no
  // negative net total) and never NaN/negative from bad input.
  const clampedDiscount = round2(Math.min(Math.max(discountAmount, 0), itemsTotal));
  // Discount reduces the item total *before* service charge/tax are
  // computed — in tax-inclusive mode this also proportionally shrinks the
  // back-out tax/service-charge amounts, matching "X off the bill" rather
  // than "X off net revenue after tax."
  const discounted = round2(itemsTotal - clampedDiscount);

  let subtotal: number;
  let serviceCharge: number;
  let tax: number;
  let total: number;

  if (settings.taxInclusive) {
    // discounted (the discounted price still shown to the customer) is
    // treated as gross — already including service charge + tax — so we
    // back those components out rather than adding them on top. The
    // customer's total never changes when tax/service-charge are turned on
    // in this mode.
    const divisor = (1 + scRate) * (1 + taxRate);
    subtotal = divisor > 0 ? round2(discounted / divisor) : discounted;
    serviceCharge = round2(subtotal * scRate);
    // tax is the remainder (not independently rounded) so the components
    // always sum back to `discounted` exactly, with no rounding drift.
    tax = round2(discounted - subtotal - serviceCharge);
    total = round2(discounted + delivery);
  } else {
    // Added on top of the (discounted) item prices already shown to the customer.
    subtotal = discounted;
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
    discountAmount: clampedDiscount,
    serviceCharge,
    tax,
    total,
    processingFee,
    taxRate,
    serviceChargeRate: scRate,
    processingFeeRate,
  };
}

export interface RefundInput {
  /** Order.total — the full amount originally charged. */
  total: number;
  /** Order.refundAmount — sum of any prior refunds against this order. */
  alreadyRefunded: number;
  /** The new refund being issued now. */
  amount: number;
}

export type RefundResult =
  | { ok: true; newRefundTotal: number; isFullyRefunded: boolean }
  | { ok: false; error: string; remaining: number };

/**
 * Pure refund-accumulation logic for the POS "Issue Refund" action — kept
 * DB-free so it's directly unit-testable, same rationale as
 * computeOrderCharges. Supports repeat partial refunds against one order;
 * paymentStatus only flips to REFUNDED once the cumulative refunded amount
 * reaches the order total (a partial refund keeps the order PAID).
 */
export function computeRefund({ total, alreadyRefunded, amount }: RefundInput): RefundResult {
  const remaining = round2(total - alreadyRefunded);

  if (amount <= 0) {
    return { ok: false, error: "Refund amount must be greater than zero", remaining };
  }
  if (amount > remaining) {
    return {
      ok: false,
      error: `Refund amount exceeds the remaining refundable total (${remaining})`,
      remaining,
    };
  }

  const newRefundTotal = round2(alreadyRefunded + amount);
  return { ok: true, newRefundTotal, isFullyRefunded: newRefundTotal >= total };
}
