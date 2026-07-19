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
