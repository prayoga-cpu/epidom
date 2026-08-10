/**
 * Pure math for storefront analytics — kept separate from the route handler
 * (`stores/[id]/storefront/analytics/route.ts`) so the rounding/divide-by-zero
 * edge cases are unit-testable without mocking Prisma.
 */

/** Percent change vs. the prior period, one decimal place. No prior traffic
 * reads as +100% when there's current traffic, 0% when there's neither. */
export function computeTrend(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10;
  return current > 0 ? 100 : 0;
}

/** `numerator` as a percent of `denominator`, one decimal place, 0 when
 * there's no denominator to divide by (e.g. zero visitors). */
export function computeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}
