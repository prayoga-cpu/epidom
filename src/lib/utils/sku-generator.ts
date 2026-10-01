/**
 * Generates a suggested SKU from a name and optional category, e.g.
 * ("Dark Chocolate", "Chocolate") -> "CHO-DAR-482". Always a valid
 * suggestion — the SKU field itself has no character restrictions, so this
 * is purely a starting point the user can still edit freely.
 */

function letters(input: string, length: number): string {
  const onlyLetters = input.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return onlyLetters.slice(0, length);
}

export function generateSku(name: string, category?: string): string {
  const namePart = letters(name, 3) || "ITM";
  const categoryPart = category ? letters(category, 3) || "GEN" : "GEN";
  const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${categoryPart}-${namePart}-${suffix}`;
}

const SKU_FROM_NAME_MAX = 32;

/**
 * A readable SKU for a row that arrived without one (an imported sheet with no
 * SKU column), e.g. "Pâte à banana" -> "PATE-A-BANANA". Deterministic, unlike
 * generateSku's random suggestion, so re-importing the same sheet proposes the
 * same codes.
 *
 * `taken` holds the SKUs already in use, UPPERCASED; the result is added to it,
 * so one set carried across a batch keeps every generated code unique (the
 * second "Latte" becomes "LATTE-2").
 */
export function skuFromName(name: string, taken: Set<string>): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SKU_FROM_NAME_MAX)
      .replace(/-+$/g, "") || "ITEM";

  let sku = base;
  for (let n = 2; taken.has(sku); n++) sku = `${base}-${n}`;
  taken.add(sku);
  return sku;
}
