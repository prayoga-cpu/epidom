/**
 * Recipe category translation helpers
 * Maps database category values to translation keys
 */

// Map of database category values to translation keys
const CATEGORY_TRANSLATION_MAP: Record<string, string> = {
  "Bread & Pastries": "breadPastries",
  "Cakes & Desserts": "cakesDesserts",
  Confectionery: "confectionery",
  "Dairy Products": "dairyProducts",
  Beverages: "beverages",
  "Sauces & Condiments": "saucesCondiments",
  Other: "other",
};

/**
 * Get the translation key for a recipe category
 * @param category - The category value from the database
 * @returns The translation key or the original category if not found
 */
export function getCategoryTranslationKey(category: string | null | undefined): string {
  if (!category) return "";
  return CATEGORY_TRANSLATION_MAP[category] || category;
}

/**
 * Get translated category using the translation function
 * @param category - The category value from the database
 * @param t - The translation function from useI18n
 * @returns The translated category string
 */
export function getTranslatedCategory(
  category: string | null | undefined,
  t: (key: string) => string
): string {
  if (!category) return "";
  const translationKey = CATEGORY_TRANSLATION_MAP[category];
  if (translationKey) {
    return t(`data.recipes.categories.${translationKey}`);
  }
  // Return original category if no translation mapping found
  return category;
}

// Export the list of category keys for form selects
export const RECIPE_CATEGORY_KEYS = [
  "breadPastries",
  "cakesDesserts",
  "confectionery",
  "dairyProducts",
  "beverages",
  "saucesCondiments",
  "other",
] as const;

// Export the list of database category values
export const RECIPE_CATEGORIES = [
  "Bread & Pastries",
  "Cakes & Desserts",
  "Confectionery",
  "Dairy Products",
  "Beverages",
  "Sauces & Condiments",
  "Other",
] as const;

export type RecipeCategoryKey = (typeof RECIPE_CATEGORY_KEYS)[number];
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
