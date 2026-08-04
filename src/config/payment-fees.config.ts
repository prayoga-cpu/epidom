import type { PaymentMethod } from "@prisma/client";

/**
 * Default payment-processing fee rates, keyed by PaymentMethod.
 *
 * These are Xendit/Stripe list-price estimates as of the release date, used
 * as a merchant-editable starting point — NOT a reconciliation with the
 * provider's actual settled fee. Xendit's callback payloads don't carry a
 * fee amount in this integration, and Stripe's real fee requires a separate
 * balance-transaction API call that isn't made here. `flat` amounts are
 * denominated in IDR, the app's base storage currency (see
 * `src/components/providers/currency-provider.tsx`) — a store operating in
 * another currency should override the flat components.
 */
export type PaymentFeeRate = {
  percent: number; // 0.007 = 0.7%
  flat: number; // flat amount in IDR
};

export const PAYMENT_FEE_DEFAULTS: Record<PaymentMethod, PaymentFeeRate> = {
  CASH: { percent: 0, flat: 0 },
  QRIS: { percent: 0.007, flat: 0 },
  GOPAY: { percent: 0.02, flat: 0 },
  OVO: { percent: 0.029, flat: 0 },
  DANA: { percent: 0.015, flat: 0 },
  SHOPEEPAY: { percent: 0.02, flat: 0 },
  BANK_TRANSFER: { percent: 0, flat: 4400 },
  STRIPE_CARD: { percent: 0.029, flat: 2000 },
  // No processing fee — payment hasn't actually happened yet at order time.
  PAY_LATER: { percent: 0, flat: 0 },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  QRIS: "QRIS",
  GOPAY: "GoPay",
  OVO: "OVO",
  DANA: "DANA",
  SHOPEEPAY: "ShopeePay",
  BANK_TRANSFER: "Bank Transfer",
  STRIPE_CARD: "Card (Stripe)",
  PAY_LATER: "Pay Later",
};

/** Partial per-method overrides a merchant has explicitly customized. */
export type PaymentFeeOverrides = Partial<Record<PaymentMethod, PaymentFeeRate>>;

/** Resolve the effective rate for a method: override if set, else the shipped default. */
export function resolvePaymentFeeRate(
  method: PaymentMethod,
  overrides?: PaymentFeeOverrides | null
): PaymentFeeRate {
  return overrides?.[method] ?? PAYMENT_FEE_DEFAULTS[method];
}

/** Compute the processing fee for a charged amount under a given method + overrides. */
export function computeProcessingFee(
  chargedAmount: number,
  method: PaymentMethod,
  overrides?: PaymentFeeOverrides | null
): number {
  const rate = resolvePaymentFeeRate(method, overrides);
  return Math.round((chargedAmount * rate.percent + rate.flat) * 100) / 100;
}
