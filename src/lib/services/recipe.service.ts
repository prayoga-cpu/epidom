import { Recipe } from "@prisma/client";
import {
  recipeRepository,
  RecipeWithIngredients,
  RecipeFilters,
} from "../repositories/recipe.repository";
import { materialRepository } from "../repositories/material.repository";

/**
 * Recipe Service
 *
 * Business logic layer for recipe operations.
 * Handles validation, authorization, and orchestrates repository calls.
 */
export class RecipeService {
  /**
   * Get all recipes for a store with filtering
   */
  async getRecipes(
    storeId: string,
    filters: RecipeFilters = {}
  ): Promise<{ recipes: RecipeWithIngredients[]; total: number }> {
    return recipeRepository.findAll(storeId, filters);
  }

  /**
   * Get recipe by ID
   */
  async getRecipeById(recipeId: string): Promise<RecipeWithIngredients | null> {
    return recipeRepository.findById(recipeId);
  }

  /**
   * Create new recipe
   */
  async createRecipe(data: {
    storeId: string;
    name: string;
    description?: string;
    category?: string;
    yieldQuantity: number;
    yieldUnit: string;
    productionTimeMinutes: number;
    instructions?: string;
    ingredients?: Array<{
      materialId: string;
      quantity: number;
      unit: string;
      notes?: string;
    }>;
  }): Promise<RecipeWithIngredients> {
    // Validate recipe name uniqueness
    const exists = await recipeRepository.existsByName(data.storeId, data.name);
    if (exists) {
      throw new Error(`Recipe with name "${data.name}" already exists`);
    }

    // Validate all materials exist and belong to the same store
    if (data.ingredients && data.ingredients.length > 0) {
      const materialIds = data.ingredients.map((i) => i.materialId);
      const materials = await materialRepository.findByIds(materialIds);

      if (materials.length !== materialIds.length) {
        throw new Error("One or more materials not found");
      }

      // Check all materials belong to the same store
      const invalidMaterials = materials.filter((m) => m.storeId !== data.storeId);
      if (invalidMaterials.length > 0) {
        throw new Error("Materials must belong to the same store as the recipe");
      }
    }

    return recipeRepository.create(data);
  }

  /**
   * Update recipe
   */
  async updateRecipe(
    recipeId: string,
    storeId: string,
    data: {
      name?: string;
      description?: string;
      category?: string;
      yieldQuantity?: number;
      yieldUnit?: string;
      productionTimeMinutes?: number;
      instructions?: string;
      ingredients?: Array<{
        materialId: string;
        quantity: number;
        unit: string;
        notes?: string;
      }>;
    }
  ): Promise<RecipeWithIngredients> {
    // Verify recipe belongs to store
    const belongsToStore = await recipeRepository.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    // If updating name, check uniqueness
    if (data.name) {
      const exists = await recipeRepository.existsByName(storeId, data.name, recipeId);
      if (exists) {
        throw new Error(`Recipe with name "${data.name}" already exists`);
      }
    }

    // Use updateWithIngredients to handle both recipe and ingredients update
    return recipeRepository.updateWithIngredients(recipeId, data);
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(recipeId: string, storeId: string): Promise<Recipe> {
    // Verify recipe belongs to store
    const belongsToStore = await recipeRepository.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    return recipeRepository.delete(recipeId);
  }

  /**
   * Bulk delete recipes
   */
  async bulkDeleteRecipes(recipeIds: string[], storeId: string): Promise<number> {
    // Verify all recipes belong to store
    const recipes = await recipeRepository.findByIds(recipeIds);
    const invalidRecipes = recipes.filter((r) => r.storeId !== storeId);

    if (invalidRecipes.length > 0) {
      throw new Error("Some recipes do not belong to this store");
    }

    return recipeRepository.bulkDelete(recipeIds);
  }

  /**
   * Add ingredient to recipe
   */
  async addIngredient(
    recipeId: string,
    storeId: string,
    materialId: string,
    quantity: number,
    unit: string,
    notes?: string
  ): Promise<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: any;
    unit: string;
    notes: string | null;
  }> {
    // Verify recipe belongs to store
    const belongsToStore = await recipeRepository.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    // Verify material exists and belongs to same store
    const material = await materialRepository.findById(materialId);
    if (!material || material.storeId !== storeId) {
      throw new Error("Material not found or does not belong to this store");
    }

    return recipeRepository.addIngredient(recipeId, materialId, quantity, unit, notes);
  }

  /**
   * Remove ingredient from recipe
   */
  async removeIngredient(materialId: string, storeId: string): Promise<void> {
    // Get ingredient to verify recipe ownership
    const recipe = await recipeRepository.findById(materialId);
    if (!recipe || recipe.storeId !== storeId) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    return recipeRepository.removeIngredient(materialId);
  }

  /**
   * Update ingredient in recipe
   */
  async updateIngredient(
    materialId: string,
    storeId: string,
    data: { quantity?: number; unit?: string; notes?: string }
  ): Promise<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: any;
    unit: string;
    notes: string | null;
  }> {
    // Get ingredient to verify recipe ownership
    const recipe = await recipeRepository.findById(materialId);
    if (!recipe || recipe.storeId !== storeId) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    return recipeRepository.updateIngredient(materialId, data);
  }

  /**
   * Duplicate recipe
   */
  async duplicateRecipe(
    recipeId: string,
    newName: string,
    storeId: string
  ): Promise<RecipeWithIngredients> {
    // Verify recipe belongs to store
    const belongsToStore = await recipeRepository.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    // Validate new name uniqueness
    const exists = await recipeRepository.existsByName(storeId, newName);
    if (exists) {
      throw new Error(`Recipe with name "${newName}" already exists`);
    }

    return recipeRepository.duplicate(recipeId, newName, storeId);
  }

  /**
   * Recalculate recipe cost
   */
  async recalculateCost(recipeId: string, storeId: string): Promise<void> {
    // Verify recipe belongs to store
    const belongsToStore = await recipeRepository.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    return recipeRepository.recalculateCost(recipeId);
  }

  /**
   * Get recipes by category
   */
  async getRecipesByCategory(storeId: string, category: string): Promise<Recipe[]> {
    return recipeRepository.findByCategory(storeId, category);
  }

  /**
   * Get recipes that use a specific material
   */
  async getRecipesByMaterial(materialId: string, storeId: string): Promise<Recipe[]> {
    const recipes = await recipeRepository.findByIngredient(materialId);
    // Filter to only return recipes from the specified store
    return recipes.filter((r) => r.storeId === storeId);
  }

  /**
   * Export recipes to CSV format
   */
  async exportRecipes(storeId: string, filters: RecipeFilters = {}): Promise<string> {
    const { recipes } = await recipeRepository.findAll(storeId, filters);

    // CSV header
    const headers = [
      "Name",
      "Category",
      "Description",
      "Yield Quantity",
      "Yield Unit",
      "Production Time (min)",
      "Cost Per Batch",
      "Cost Per Unit",
      "Ingredients Count",
      "Created At",
    ];

    // CSV rows
    const rows = recipes.map((recipe) => {
      const costPerUnit =
        Number(recipe.yieldQuantity) > 0
          ? Number(recipe.costPerBatch) / Number(recipe.yieldQuantity)
          : 0;

      return [
        `"${recipe.name}"`,
        `"${recipe.category || ""}"`,
        `"${recipe.description || ""}"`,
        recipe.yieldQuantity,
        recipe.yieldUnit,
        recipe.productionTimeMinutes,
        recipe.costPerBatch,
        costPerUnit.toFixed(2),
        recipe.ingredients.length,
        new Date(recipe.createdAt).toISOString(),
      ];
    });

    // Combine headers and rows
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    return csv;
  }
}

// Export singleton instance
export const recipeService = new RecipeService();
