/**
 * How many decimal places the till works in for a currency — what "the smallest
 * amount a customer can actually hand over" means, and therefore what an equal
 * split rounds each share to (see splitEqually in split-bill.ts).
 *
 * Intl alone is not enough: it reports Rupiah with 2 decimals (the ISO 4217
 * minor unit), yet nobody has paid in sen for decades and the app formats IDR
 * with none — src/lib/utils/formatting.ts carries the same override. Without it
 * a three-way split of Rp 100.000 would deal out 33.333,33 shares.
 */
const DECIMALS_OVERRIDE: Record<string, number> = { IDR: 0 };

export function getCurrencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  const override = DECIMALS_OVERRIDE[code];
  if (override !== undefined) return override;
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    // An unknown / malformed code: cents are the safe default.
    return 2;
  }
}
