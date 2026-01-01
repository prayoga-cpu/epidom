import { Recipe, Prisma, RecipeProduct, Product } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Recipe Repository
 *
 * Handles all database operations related to recipes and their ingredients.
 * Follows the repository pattern for clean architecture and separation of concerns.
 */

export type RecipeWithIngredients = Recipe & {
  ingredients: Array<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: Prisma.Decimal;
    unit: string;
    notes: string | null;
    material: {
      id: string;
      name: string;
      unit: string;
      unitCost: Prisma.Decimal;
      currentStock: Prisma.Decimal;
    };
  }>;
  recipeProducts?: Array<RecipeProduct & { product: Product }>;
};

export interface RecipeFilters {
  search?: string;
  category?: string;
  sortBy?:
    | "name"
    | "category"
    | "productionTimeMinutes"
    | "costPerBatch"
    | "createdAt"
    | "updatedAt";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

export class RecipeRepository extends BaseRepository {
  /**
   * Find all recipes for a store with optional filtering
   */
  async findAll(
    storeId: string,
    filters: RecipeFilters = {}
  ): Promise<{ recipes: RecipeWithIngredients[]; total: number }> {
    const {
      search,
      category,
      sortBy = "createdAt",
      sortOrder = "desc",
      skip = 0,
      take = 50,
    } = filters;

    // Build where clause
    const where: Prisma.RecipeWhereInput = {
      storeId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(category && { category }),
    };

    // Build orderBy clause
    const orderBy: Prisma.RecipeOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Fetch recipes with includes
    const [recipes, total] = await Promise.all([
      this.db.recipe.findMany({
        where,
        include: {
          ingredients: {
            include: {
              material: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  unitCost: true,
                  currentStock: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          recipeProducts: {
            include: {
              product: true,
            },
            orderBy: {
              createdAt: "asc", // Order by creation date
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.db.recipe.count({ where }),
    ]);

    return {
      recipes: recipes as RecipeWithIngredients[],
      total,
    };
  }

  /**
   * Find recipe by ID with ingredients
   */
  async findById(recipeId: string): Promise<RecipeWithIngredients | null> {
    const recipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                unit: true,
                unitCost: true,
                currentStock: true,
                sku: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        recipeProducts: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: "asc", // Order by creation date
          },
        },
      },
    });

    return recipe as RecipeWithIngredients | null;
  }

  /**
   * Check if recipe name already exists for a store
   */
  async existsByName(storeId: string, name: string, excludeId?: string): Promise<boolean> {
    const recipe = await this.db.recipe.findFirst({
      where: {
        storeId,
        name: {
          equals: name,
          mode: "insensitive",
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return recipe !== null;
  }

  /**
   * Create a new recipe with ingredients
   */
  async create(data: {
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
    const { ingredients, ...recipeData } = data;

    // Calculate cost per batch if ingredients provided
    let costPerBatch = 0;
    if (ingredients && ingredients.length > 0) {
      const materialIds = ingredients.map((i) => i.materialId);
      const materials = await this.db.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true, unitCost: true },
      });

      const materialCostMap = new Map(materials.map((m) => [m.id, Number(m.unitCost)]));

      costPerBatch = ingredients.reduce((sum, ing) => {
        const unitCost = materialCostMap.get(ing.materialId) || 0;
        return sum + unitCost * ing.quantity;
      }, 0);
    }

    const recipe = await this.db.recipe.create({
      data: {
        ...recipeData,
        costPerBatch,
        ...(ingredients &&
          ingredients.length > 0 && {
            ingredients: {
              create: ingredients.map((ing) => ({
                materialId: ing.materialId,
                quantity: ing.quantity,
                unit: ing.unit,
                notes: ing.notes || null,
              })),
            },
          }),
      },
      include: {
        ingredients: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                unit: true,
                unitCost: true,
                currentStock: true,
              },
            },
          },
        },
      },
    });

    return recipe as RecipeWithIngredients;
  }

  /**
   * Update recipe
   */
  async update(
    recipeId: string,
    data: Partial<Omit<Recipe, "id" | "storeId" | "createdAt" | "updatedAt">>
  ): Promise<Recipe> {
    return this.db.recipe.update({
      where: { id: recipeId },
      data,
    });
  }

  /**
   * Update recipe with ingredients
   * This replaces all ingredients with the new ones provided
   */
  async updateWithIngredients(
    recipeId: string,
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
    const { ingredients, ...recipeData } = data;

    // Start a transaction to update recipe and replace ingredients
    const result = await this.db.$transaction(async (tx) => {
      // 1. Update recipe basic info
      const updatedRecipe = await tx.recipe.update({
        where: { id: recipeId },
        data: recipeData,
      });

      // 2. If ingredients are provided, replace them
      if (ingredients !== undefined) {
        // Delete all existing ingredients
        await tx.recipeIngredient.deleteMany({
          where: { recipeId },
        });

        // Create new ingredients if any
        if (ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({
              recipeId,
              materialId: ing.materialId,
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes || null,
            })),
          });
        }

        // 3. Recalculate cost based on new ingredients
        if (ingredients.length > 0) {
          const materialIds = ingredients.map((ing) => ing.materialId);
          const materials = await tx.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, unitCost: true },
          });

          let totalCost = 0;
          ingredients.forEach((ing) => {
            const material = materials.find((m) => m.id === ing.materialId);
            if (material) {
              totalCost += Number(material.unitCost) * ing.quantity;
            }
          });

          await tx.recipe.update({
            where: { id: recipeId },
            data: {
              costPerBatch: totalCost,
            },
          });
        } else {
          // No ingredients, set cost to 0
          await tx.recipe.update({
            where: { id: recipeId },
            data: {
              costPerBatch: 0,
            },
          });
        }
      }

      // 4. Fetch and return the complete updated recipe with ingredients
      const finalRecipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: {
          ingredients: {
            include: {
              material: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  unitCost: true,
                  currentStock: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!finalRecipe) {
        throw new Error("Recipe not found after update");
      }

      return finalRecipe as RecipeWithIngredients;
    });

    return result;
  }

  /**
   * Hard delete recipe
   */
  async delete(recipeId: string): Promise<Recipe> {
    // Delete will cascade to RecipeIngredient due to schema relationship
    return this.db.recipe.delete({
      where: { id: recipeId },
    });
  }

  /**
   * Bulk hard delete recipes
   */
  async bulkDelete(recipeIds: string[]): Promise<{ count: number }> {
    const result = await this.db.recipe.deleteMany({
      where: {
        id: {
          in: recipeIds,
        },
      },
    });
    return result;
  }

  /**
   * Add ingredient to recipe
   */
  async addIngredient(
    recipeId: string,
    materialId: string,
    quantity: number,
    unit: string,
    notes?: string
  ): Promise<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: Prisma.Decimal;
    unit: string;
    notes: string | null;
  }> {
    const ingredient = await this.db.recipeIngredient.create({
      data: {
        recipeId,
        materialId,
        quantity,
        unit,
        notes: notes || null,
      },
    });

    // Recalculate recipe cost
    await this.recalculateCost(recipeId);

    return ingredient;
  }

  /**
   * Remove ingredient from recipe
   */
  async removeIngredient(materialId: string): Promise<void> {
    const ingredient = await this.db.recipeIngredient.findUnique({
      where: { id: materialId },
      select: { recipeId: true },
    });

    await this.db.recipeIngredient.delete({
      where: { id: materialId },
    });

    // Recalculate recipe cost if we have the recipe ID
    if (ingredient?.recipeId) {
      await this.recalculateCost(ingredient.recipeId);
    }
  }

  /**
   * Update ingredient in recipe
   */
  async updateIngredient(
    materialId: string,
    data: { quantity?: number; unit?: string; notes?: string }
  ): Promise<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: Prisma.Decimal;
    unit: string;
    notes: string | null;
  }> {
    const ingredient = await this.db.recipeIngredient.update({
      where: { id: materialId },
      data,
    });

    // Recalculate recipe cost
    await this.recalculateCost(ingredient.recipeId);

    return ingredient;
  }

  /**
   * Recalculate recipe cost based on current ingredient prices
   */
  async recalculateCost(recipeId: string): Promise<void> {
    const recipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
      select: {
        yieldQuantity: true,
        ingredients: {
          include: {
            material: {
              select: { unitCost: true },
            },
          },
        },
      },
    });

    if (!recipe) return;

    const costPerBatch = recipe.ingredients.reduce((sum, ing) => {
      const quantity = Number(ing.quantity);
      const unitCost = Number(ing.material.unitCost);
      return sum + quantity * unitCost;
    }, 0);

    await this.db.recipe.update({
      where: { id: recipeId },
      data: {
        costPerBatch,
      },
    });
  }

  /**
   * Find recipes by category
   */
  async findByCategory(storeId: string, category: string): Promise<Recipe[]> {
    return this.db.recipe.findMany({
      where: {
        storeId,
        category,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Find recipes that use a specific ingredient
   */
  async findByIngredient(materialId: string): Promise<Recipe[]> {
    return this.db.recipe.findMany({
      where: {
        ingredients: {
          some: {
            materialId,
          },
        },
      },
      include: {
        ingredients: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Duplicate a recipe with new name
   */
  async duplicate(
    recipeId: string,
    newName: string,
    storeId: string
  ): Promise<RecipeWithIngredients> {
    const originalRecipe = await this.findById(recipeId);
    if (!originalRecipe) {
      throw new Error("Recipe not found");
    }

    // Create new recipe with same data but new name
    const duplicatedRecipe = await this.create({
      storeId,
      name: newName,
      description: originalRecipe.description || undefined,
      category: originalRecipe.category || undefined,
      yieldQuantity: Number(originalRecipe.yieldQuantity),
      yieldUnit: originalRecipe.yieldUnit,
      productionTimeMinutes: originalRecipe.productionTimeMinutes,
      instructions: originalRecipe.instructions || undefined,
      ingredients: originalRecipe.ingredients.map((ing) => ({
        materialId: ing.materialId,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        notes: ing.notes || undefined,
      })),
    });

    return duplicatedRecipe;
  }

  /**
   * Count recipes by filters
   */
  async count(where?: Prisma.RecipeWhereInput): Promise<number> {
    return this.db.recipe.count({ where });
  }

  /**
   * Find recipes by IDs (batch)
   */
  async findByIds(recipeIds: string[]): Promise<Recipe[]> {
    return this.db.recipe.findMany({
      where: { id: { in: recipeIds } },
    });
  }

  /**
   * Check if recipe belongs to store
   */
  async belongsToStore(recipeId: string, storeId: string): Promise<boolean> {
    const recipe = await this.db.recipe.findUnique({
      where: { id: recipeId },
      select: { storeId: true },
    });
    return recipe?.storeId === storeId;
  }
}

// Export singleton instance
export const recipeRepository = new RecipeRepository();
