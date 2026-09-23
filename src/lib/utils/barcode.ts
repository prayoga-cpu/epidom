import { BARCODE_MAX_LENGTH, BARCODE_PATTERN } from "@/lib/validation/inventory.schemas";

/**
 * Read a product barcode out of an imported spreadsheet / AI-mapped cell.
 *
 * Lives here rather than in data/actions.ts because a "use server" file may only
 * export async functions, and this is worth a unit test: a spreadsheet cell holding
 * 8991234567890 arrives as a NUMBER, and a blank one as "" — neither may reach the
 * database as anything but a clean string or nothing.
 *
 *   - null / undefined / blank  -> { }               (no barcode: leave the column alone)
 *   - a valid code              -> { barcode }        (trimmed, case kept — scanners match exactly)
 *   - an unusable code          -> { error }          (the row fails with this message)
 *
 * Applies the same rule as the Add/Edit product form (barcodeSchema) so an
 * import can never store a code the form would have refused.
 */
export function parseImportedBarcode(value: unknown): { barcode?: string; error?: string } {
  if (value === undefined || value === null) return {};
  const barcode = String(value).trim();
  if (!barcode) return {};

  if (barcode.length > BARCODE_MAX_LENGTH || !BARCODE_PATTERN.test(barcode)) {
    return {
      error: `Barcode "${barcode.slice(0, 20)}" is invalid: use up to ${BARCODE_MAX_LENGTH} letters, digits or . _ - / + (no spaces)`,
    };
  }
  return { barcode };
}
