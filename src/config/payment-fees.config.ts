import type { PaymentMethod, PaymentMarket } from "@prisma/client";

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
  // Indonesia
  LINKAJA: { percent: 0.015, flat: 0 },
  // France — Cheque has no processing fee; Titre-Restaurant vouchers are
  // typically redeemed through an issuer (Edenred/Swile/Up) that deducts a
  // commission before reimbursing the merchant.
  CHEQUE: { percent: 0, flat: 0 },
  TITRE_RESTAURANT: { percent: 0.05, flat: 0 },
  // Worldwide — Apple/Google Pay ride the same card networks Stripe already
  // charges for, so they default to the same rate as STRIPE_CARD.
  PAYPAL: { percent: 0.0349, flat: 0 },
  APPLE_PAY: { percent: 0.029, flat: 2000 },
  GOOGLE_PAY: { percent: 0.029, flat: 2000 },
  // Unknown by definition — merchant should override if it carries a fee.
  OTHER: { percent: 0, flat: 0 },
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
  LINKAJA: "LinkAja",
  CHEQUE: "Cheque",
  TITRE_RESTAURANT: "Meal Voucher (Titre-Restaurant)",
  PAYPAL: "PayPal",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  OTHER: "Other",
};

/** Mirrors the schema-level default for a brand-new finance-settings row. */
export const DEFAULT_ENABLED_PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
  "STRIPE_CARD",
];

/**
 * The payment rails offered by default in each market — matches the market
 * groupings already called out in the PAYMENT_FEE_DEFAULTS comments above.
 * Used to scope the Fees & Taxes processing-fee table and to reset
 * `enabledPaymentMethods` when a merchant switches market. PAY_LATER and
 * OTHER are deliberately absent — PAY_LATER has its own dedicated toggle,
 * and OTHER is an opt-in catch-all never enabled by default.
 */
export const PAYMENT_METHODS_BY_MARKET: Record<PaymentMarket, PaymentMethod[]> = {
  INDONESIA: ["CASH", "QRIS", "GOPAY", "OVO", "DANA", "SHOPEEPAY", "BANK_TRANSFER", "STRIPE_CARD", "LINKAJA"],
  FRANCE: ["CASH", "BANK_TRANSFER", "STRIPE_CARD", "CHEQUE", "TITRE_RESTAURANT"],
  INTERNATIONAL: ["CASH", "BANK_TRANSFER", "STRIPE_CARD", "PAYPAL", "APPLE_PAY", "GOOGLE_PAY"],
};

/**
 * One-time suggested market for a store/business, from currency + locale +
 * country — used to seed new rows and as the "Detect automatically" action
 * in the Fees & Taxes dialog. Never runs silently on every read: a
 * merchant's manually chosen market always sticks once saved.
 */
export function inferMarket(input: {
  currency: string;
  locale: string | null | undefined;
  country: string | null | undefined;
}): PaymentMarket {
  const country = input.country ?? "";
  if (input.currency === "IDR" && input.locale === "id" && /indonesia/i.test(country)) {
    return "INDONESIA";
  }
  if (input.currency === "EUR" && input.locale === "fr" && /france/i.test(country)) {
    return "FRANCE";
  }
  return "INTERNATIONAL";
}

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
