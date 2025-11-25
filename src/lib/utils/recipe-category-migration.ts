/**
 * Recipe Category Migration Utility
 *
 * This utility helps migrate existing recipe categories from translated values
 * to category keys for proper multilanguage support.
 *
 * Old format: "Bread & Pastries", "Cakes & Desserts", etc. (translated text)
 * New format: "BREAD_PASTRIES", "CAKES_DESSERTS", etc. (keys)
 */

// Mapping of old translated category values to new category keys
// This covers all three languages: English, French, and Indonesian
export const CATEGORY_MIGRATION_MAP: Record<string, string> = {
  // English
  "Bread & Pastries": "BREAD_PASTRIES",
  "Cakes & Desserts": "CAKES_DESSERTS",
  Confectionery: "CONFECTIONERY",
  "Dairy Products": "DAIRY_PRODUCTS",
  Beverages: "BEVERAGES",
  "Sauces & Condiments": "SAUCES_CONDIMENTS",
  Other: "OTHER",

  // French
  "Pains & Pâtisseries": "BREAD_PASTRIES",
  "Gâteaux & Desserts": "CAKES_DESSERTS",
  Confiserie: "CONFECTIONERY",
  "Produits Laitiers": "DAIRY_PRODUCTS",
  Boissons: "BEVERAGES",
  Autre: "OTHER",

  // Indonesian
  "Roti & Kue": "BREAD_PASTRIES",
  "Kue & Dessert": "CAKES_DESSERTS",
  Permen: "CONFECTIONERY",
  "Produk Susu": "DAIRY_PRODUCTS",
  Minuman: "BEVERAGES",
  "Saus & Bumbu": "SAUCES_CONDIMENTS",
  Lainnya: "OTHER",
};

/**
 * Migrate a category value from old format to new format
 * @param oldCategory - The old category value (translated text)
 * @returns The new category key, or the original value if no mapping found
 */
export function migrateCategoryValue(oldCategory: string | null): string | null {
  if (!oldCategory) return null;

  // If already a key (all uppercase with underscores), return as is
  if (/^[A-Z_]+$/.test(oldCategory)) {
    return oldCategory;
  }

  // Try to find mapping
  const newKey = CATEGORY_MIGRATION_MAP[oldCategory];
  if (newKey) {
    return newKey;
  }

  // If no mapping found, return original value
  // This handles custom categories or edge cases
  console.warn(`No migration mapping found for category: "${oldCategory}"`);
  return oldCategory;
}

/**
 * Get all valid category keys
 */
export const VALID_CATEGORY_KEYS = [
  "BREAD_PASTRIES",
  "CAKES_DESSERTS",
  "CONFECTIONERY",
  "DAIRY_PRODUCTS",
  "BEVERAGES",
  "SAUCES_CONDIMENTS",
  "OTHER",
] as const;

export type RecipeCategoryKey = (typeof VALID_CATEGORY_KEYS)[number];
