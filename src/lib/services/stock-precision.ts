/**
 * Rounding discipline for every stock write.
 *
 * StockMovement.quantity, StockMovement.balanceAfter, Material.currentStock and
 * Product.currentStock are all `Decimal(10,3)`. Postgres rounds each column
 * INDEPENDENTLY, so handing an unrounded 0.0185 to both writes stores -0.019 in
 * the movement while moving the balance by 0.018 — 0.001 of permanent drift per
 * sale, and `Σ movement.quantity` stops reconciling against `currentStock`
 * forever.
 *
 * Round ONCE with `roundStock` and write that identical value to both, so the
 * ledger closes by construction.
 */
export const STOCK_SCALE = 3;

/** Anything strictly below this rounds to 0.000 at Decimal(10,3). */
export const STOCK_EPSILON = 5e-4;

export function roundStock(n: number): number {
  return Math.round(n * 10 ** STOCK_SCALE) / 10 ** STOCK_SCALE;
}

/**
 * True when a genuine, non-zero requirement disappears at `Decimal(10,3)`.
 *
 * e.g. 0.4 g of saffron against a material stocked in kg is 0.0004 → 0.000: the
 * deduction would be a silent no-op forever, dressed up as a successful
 * deduction. Callers must NOT write a zero movement — they log and surface it
 * instead.
 *
 * Fixing this is a merchant data change (stock that material in grams, not
 * kilograms), not a rounding change. Silently guessing units would be worse
 * than the bug. See scripts/report-below-precision-ingredients.ts.
 */
export function roundsAwayToZero(raw: number): boolean {
  return raw > 0 && roundStock(raw) === 0;
}
