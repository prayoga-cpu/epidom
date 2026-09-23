import type { CartDiscountSource } from "../types/pos.types";

/**
 * A finance rate (a 0–1 fraction, as ResolvedFinanceSettings stores it) as the
 * percentage the cashier and the customer expect to read: 0.1 → "10%", 0.055 →
 * "5.5%". Locale-aware so a French till reads "10 %" and "5,5 %".
 */
export function formatRatePercent(rate: number, locale = "en"): string {
  const safe = Number.isFinite(rate) ? rate : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${Math.round(safe * 10000) / 100}%`;
  }
}

/**
 * The short human label for the cart's primary discount: the cashier's reason
 * for a manual one, the preset's name, or "Coupon CODE". Null when there is
 * nothing worth showing (no discount, or a manual one with no reason).
 */
export function discountSourceLabel(
  source: CartDiscountSource | null,
  couponLabel: (code: string) => string
): string | null {
  if (!source) return null;
  if (source.kind === "manual") return source.reason?.trim() || null;
  if (source.kind === "preset") return source.name;
  return couponLabel(source.code);
}

/** Sum of the lines before any discount, service charge or tax. */
export function itemsTotalOf(items: Array<{ lineTotal: number }>): number {
  return Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
}

/**
 * "3 pax" / "1 couvert": a guest count with its own singular, because "1
 * couverts" is wrong in French and the two-key split is the only way to keep
 * the string translatable without a plural library.
 */
export function formatPax(t: (key: string) => string, count: number): string {
  return count === 1
    ? t("cashierCart.header.paxCountOne")
    : t("cashierCart.header.paxCount").replace("{count}", String(count));
}
