/**
 * Number parsing for imported sheets. Lives outside the "use server" action
 * file so it can be unit-tested.
 */

/**
 * Parse a number typed or pasted in any common format ($5,000.00, 1.500,50,
 * 0,5 …) into a plain float. Used for quantities and, through
 * parseImportedMoney below, for prices.
 *
 * A single dot is always read as a decimal point here ("1.500" kg is one and a
 * half), which is right for a quantity and wrong for a price in most
 * currencies — see parseImportedMoney.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGlobalNumber(value: any): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;

  let str = String(value).trim();
  // Remove currency symbols and non-numeric chars except . , -
  str = str.replace(/[^0-9.,-]/g, "");

  if (!str) return 0;

  // Heuristic to detect format:
  // If connection contains both . and , -> last one is usually decimal
  // 10.000,00 -> remove thousand sep (.), replace decimal (,) with .
  // 10,000.00 -> remove thousand sep (,), keep decimal (.)

  if (str.includes(",") && str.includes(".")) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // European/Indo format: 1.000,00 -> 1000.00
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,000.00 -> 1000.00
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Ambiguous: 10,000 (ten thousand) vs 10,5 (ten point five)
    // If we have 3 digits after comma, likely thousand separator (10,000)
    // If 2 digits, likely decimal (10,50) - BUT THIS IS RISKY
    // Safe bet for commerce: if comma is being used and no dots, treat as thousand separator IF it makes sense?
    // Actually, widespread convention in data:
    // If it looks like 10,000 it is 10000.
    // If it looks like 5,5 it is 5.5.

    // Safer approach: Standardize to US float for storage
    // If >1 commas, it's definitely update separators (1,000,000) -> remove all
    if ((str.match(/,/g) || []).length > 1) {
      str = str.replace(/,/g, "");
    } else {
      // Single comma. 10,000 or 0,5?
      // Check if followed by 3 digits exactly at end -> likely thousand sep
      if (/,\d{3}$/.test(str)) {
        str = str.replace(/,/g, "");
      } else {
        // Likely decimal
        str = str.replace(",", ".");
      }
    }
  }
  // Remove remaining thousand separators (dots if used as such not handled above?)
  // If we have multiple dots: 1.000.000 -> remove all
  if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, "");
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

/** Dot-grouped thousands with nothing after them: 10.000, 1.250.000. Never 0.025. */
const DOT_GROUPED_THOUSANDS = /^-?[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * Parse a PRICE from an imported sheet.
 *
 * Identical to parseGlobalNumber except for one shape, in a currency written
 * without decimals (Rupiah, Ariary, Yen, Dong…): digits grouped by dots in
 * threes, "10.000" or "Rp 25.000". There it can only be the thousands
 * separator, and reading it as a decimal stored a Rp 10.000 item at Rp 10.
 *
 * `decimals` is the currency's working precision (getCurrencyDecimals). In a
 * currency WITH decimals the same shape stays a decimal: a unit cost of 1.375
 * per kilo is a real figure in euros, and turning it into 1375 would be the
 * same thousandfold mistake in the other direction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseImportedMoney(value: any, decimals = 2): number {
  if (typeof value === "string" && decimals === 0) {
    const digits = value.trim().replace(/[^0-9.,-]/g, "");
    if (DOT_GROUPED_THOUSANDS.test(digits)) return parseFloat(digits.replace(/\./g, ""));
  }
  return parseGlobalNumber(value);
}
