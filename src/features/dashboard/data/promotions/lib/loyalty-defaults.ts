/**
 * Suggested loyalty-program amounts per store currency.
 *
 * These exist ONLY to help an owner who has never configured the program. They
 * are shown as input placeholders and behind an explicit "Use suggested values"
 * button — never saved on the owner's behalf. The server stores exactly what the
 * owner submitted (an unset amount stays 0), which is why nothing here is a
 * "default" in the persistence sense.
 *
 * Amounts are LITERAL in the store's display currency (never IDR-converted), so
 * the right scale genuinely differs per currency: 10.000 Rp per point is a
 * sensible earn rate, 10.000 EUR per point would mean nobody ever earns one.
 */

export interface LoyaltySuggestion {
  /** Amount spent to earn ONE point. */
  spendPerPoint: number;
  /** Value of ONE point when redeemed. */
  pointValue: number;
}

const IDR_SUGGESTION: LoyaltySuggestion = { spendPerPoint: 10_000, pointValue: 100 };

/** 1 point per unit spent, worth 5% back. Also the fallback for every other currency. */
const EURO_STYLE_SUGGESTION: LoyaltySuggestion = { spendPerPoint: 1, pointValue: 0.05 };

const SUGGESTIONS: Record<string, LoyaltySuggestion> = {
  IDR: IDR_SUGGESTION,
  EUR: EURO_STYLE_SUGGESTION,
  USD: EURO_STYLE_SUGGESTION,
};

/**
 * The suggestion for `currency`. Any currency without its own row falls back to
 * the EUR/USD style — the honest answer for the many stores whose currency we
 * have no local convention for is "a sensible shape, edit it".
 *
 * Returns a fresh object so a caller can never mutate the shared table.
 */
export function suggestedLoyaltyValues(currency: string): LoyaltySuggestion {
  const suggestion = SUGGESTIONS[currency.trim().toUpperCase()] ?? EURO_STYLE_SUGGESTION;
  return { ...suggestion };
}
