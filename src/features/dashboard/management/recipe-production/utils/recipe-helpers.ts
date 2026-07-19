/**
 * Recipe helper utilities for production management
 */

export interface RecipeIngredient {
  material: {
    currentStock: number | string;
  };
}

export interface Recipe {
  id: string;
  ingredients?: RecipeIngredient[];
}

/**
 * Check if material stock has changed between two recipes
 * Performs shallow comparison of currentStock values
 *
 * @param oldRecipe - Previous recipe state
 * @param newRecipe - Updated recipe state
 * @returns true if stock has changed, false otherwise
 */
export function hasMaterialStockChanged(oldRecipe: Recipe | null, newRecipe: Recipe): boolean {
  if (!oldRecipe?.ingredients || !newRecipe.ingredients) {
    return true; // If ingredients are missing, consider it changed
  }

  // Compare each ingredient's currentStock
  return newRecipe.ingredients.some((ing, idx) => {
    const oldIng = oldRecipe.ingredients?.[idx];
    if (!oldIng) return true;

    // Compare stock values (handle both number and string types)
    const oldStock = Number(oldIng.material.currentStock);
    const newStock = Number(ing.material.currentStock);

    return oldStock !== newStock;
  });
}
