/**
 * Stripe amounts are integers in the currency's smallest unit (cents), except
 * for zero-decimal currencies, whose amounts are already whole units. IDR is
 * NOT zero-decimal on Stripe: Rp 229.000 travels as 22900000.
 *
 * SaaS billing only (subscriptions, admin revenue, partner commissions). The
 * storefront's Stripe payments keep their own copy in
 * src/lib/payments/providers/stripe-customer.ts: SaaS billing and customer
 * payments stay in separate modules (AGENTS.md §7.5).
 */
export const STRIPE_ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

export function isZeroDecimalCurrency(currency: string): boolean {
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase());
}

/** A Stripe amount in its currency's major unit, as a number (for reports). */
export function stripeAmountToMajor(minor: number, currency: string): number {
  return isZeroDecimalCurrency(currency) ? minor : minor / 100;
}

/**
 * A Stripe amount as an exact decimal string in the major unit ("12.59",
 * "229000.00"), for a Prisma Decimal column: no float rounding on the way.
 */
export function stripeAmountToDecimalString(minor: number, currency: string): string {
  const n = Math.trunc(minor);
  if (isZeroDecimalCurrency(currency)) return `${n}.00`;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** The inverse of stripeAmountToDecimalString: a stored major-unit decimal back to Stripe's integer. */
export function decimalStringToStripeAmount(value: string | number, currency: string): number {
  const text = String(value).trim();
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace(/^[-+]/, "").split(".");
  const units = Number(whole) || 0;
  if (isZeroDecimalCurrency(currency)) return negative ? -units : units;
  const cents = Number((fraction + "00").slice(0, 2)) || 0;
  const minor = units * 100 + cents;
  return negative ? -minor : minor;
}
