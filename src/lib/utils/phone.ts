/**
 * Phone normalisation for the Customer table.
 *
 * A customer is identified by `(storeId, phone)`, so the SAME number typed as
 * "0812 3456 7890", "+62 812-3456-7890" and "6281234567890" must collapse to ONE
 * string or the unique index stops meaning anything and a returning customer
 * gets a second record (and a second, empty points balance). The canonical form
 * is E.164 — "+" and 7-15 digits — which is also what the shared PhoneInput
 * emits and what WhatsApp/Fonnte accept once the "+" is dropped.
 *
 * Deliberately dependency-free: libphonenumber-js is only a transitive
 * dependency here (react-phone-number-input), and per-country validity is not
 * worth a hard failure at a till — the cashier needs a number that is stable,
 * not one a telecom registry has verified.
 */

// "+" then 7-15 digits, first digit 1-9 (no country code starts with 0).
const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Country calling code assumed for a number typed WITHOUT one ("0612345678"),
 * derived from the store's display currency — the only per-store signal that is
 * always set. Best-effort by design: a number that already carries its
 * "+<country>" prefix never depends on this.
 */
const CALLING_CODE_BY_CURRENCY: Record<string, string> = {
  IDR: "62",
  EUR: "33",
  USD: "1",
  GBP: "44",
  SGD: "65",
  MYR: "60",
  AUD: "61",
};

export function callingCodeForCurrency(currency: string | null | undefined): string | undefined {
  return currency ? CALLING_CODE_BY_CURRENCY[currency.toUpperCase()] : undefined;
}

/**
 * The E.164 form of `raw`, or null when it cannot be made into one.
 *
 * Accepts: "+33 6 12 34 56 78", "0033612345678", "+33 (0)6 12 34 56 78" (the
 * bracketed trunk 0 is dropped — keeping it yields an invalid number), and — when
 * `defaultCallingCode` is known — a national number with a leading trunk 0
 * ("06 12 34 56 78") or one that already starts with the calling code
 * ("6281234567890").
 */
export function normalizePhone(
  raw: string | null | undefined,
  opts: { defaultCallingCode?: string } = {}
): string | null {
  if (!raw) return null;
  // "(0)" right after a country code is the optional trunk digit some people
  // type in brackets: drop it before punctuation is stripped, or the 0 leaks
  // into the number.
  let s = raw
    .trim()
    .replace(/\(0\)/g, "")
    .replace(/[\s\-(). ]/g, "");
  if (!s) return null;

  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) return E164.test(s) ? s : null;

  if (!/^\d+$/.test(s)) return null;

  const cc = opts.defaultCallingCode;
  if (!cc) return null;

  if (s.startsWith("0")) {
    const candidate = `+${cc}${s.slice(1)}`;
    return E164.test(candidate) ? candidate : null;
  }
  if (s.startsWith(cc)) {
    const candidate = `+${s}`;
    return E164.test(candidate) ? candidate : null;
  }
  return null;
}

/**
 * The digits to look for when a cashier searches customers by phone. The
 * stored value is E.164 ("+33612345678") but people type national numbers
 * ("06 12 34 56 78"), so a plain substring match on the raw query would miss the
 * customer that is sitting right there. Dropping punctuation AND the trunk 0
 * ("612345678") makes both spellings hit the same row. Null under 3 digits —
 * "0" or "06" would match half the table.
 */
export function phoneSearchDigits(query: string): string | null {
  const digits = query.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 3 ? digits : null;
}
