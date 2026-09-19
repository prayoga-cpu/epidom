/**
 * Quick-tender buttons for the cash section of checkout: the exact amount, then
 * the round-ups a customer most plausibly hands over.
 *
 * Amounts are literal in the store's display currency and are never converted,
 * so the denomination steps are chosen by currency code, not by locale. EUR,
 * USD and IDR — the store markets this app serves — carry hand-picked steps;
 * any other currency falls back to steps scaled to the total's magnitude.
 */

const STEPS_BY_CURRENCY: Record<string, readonly number[]> = {
  EUR: [5, 10, 20, 50, 100],
  USD: [5, 10, 20, 50, 100],
  IDR: [5_000, 10_000, 50_000, 100_000],
};

/** Exact + up to four round-ups. */
export const MAX_CASH_PRESETS = 5;

const EPS = 1e-9;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function genericSteps(total: number): number[] {
  const magnitude = Math.pow(10, Math.floor(Math.log10(total)));
  return [magnitude / 2, magnitude, magnitude * 5, magnitude * 10];
}

/**
 * The exact total first (the customer paying the bill to the cent), followed by
 * ascending amounts above it drawn from each step's next round-up. Each step
 * contributes both its ceiling (36k → 40k on a 5k/10k step) and the next one up
 * when the total already sits on a boundary (100k → 105k/110k/150k/200k), so
 * the row never collapses to a single button.
 */
export function getCashPresets(total: number, currency: string): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];

  const exact = round2(total);
  const steps = STEPS_BY_CURRENCY[currency.toUpperCase()] ?? genericSteps(exact);

  const candidates = new Set<number>();
  for (const step of steps) {
    const up = round2(Math.ceil(exact / step - EPS) * step);
    const above = round2((Math.floor(exact / step + EPS) + 1) * step);
    if (up > exact) candidates.add(up);
    if (above > exact) candidates.add(above);
  }

  const rounded = [...candidates].sort((a, b) => a - b).slice(0, MAX_CASH_PRESETS - 1);
  return [exact, ...rounded];
}
