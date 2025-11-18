import { ProductionBatch, ProductionStatus, MovementType, Prisma } from "@prisma/client";
import {
  productionBatchRepository,
  ProductionBatchWithRelations,
  ProductionBatchFilters,
} from "../repositories/production-batch.repository";
import { recipeRepository } from "../repositories/recipe.repository";
import { materialRepository } from "../repositories/material.repository";
import { productRepository } from "../repositories/product.repository";
import { prisma } from "../prisma";

/**
 * Production Batch Service
 *
 * Business logic layer for production batch operations.
 * Handles material validation, stock movements, and production workflows.
 */
export class ProductionBatchService {
  /**
   * Get all production batches for a store with filtering
   */
  async getProductionBatches(
    storeId: string,
    filters: ProductionBatchFilters = {}
  ): Promise<{ batches: ProductionBatchWithRelations[]; total: number }> {
    return productionBatchRepository.findAll(storeId, filters);
  }

  /**
   * Get production batch by ID
   */
  async getProductionBatchById(batchId: string): Promise<ProductionBatchWithRelations | null> {
    return productionBatchRepository.findById(batchId);
  }

  /**
   * Get active batches for a recipe
   */
  async getActiveBatchesByRecipe(
    storeId: string,
    recipeId: string
  ): Promise<ProductionBatchWithRelations[]> {
    return productionBatchRepository.getActiveBatchesByRecipe(storeId, recipeId);
  }

  /**
   * Check material availability for a recipe
   */
  async checkMaterialAvailability(
    recipeId: string,
    multiplier: number = 1
  ): Promise<{
    isAvailable: boolean;
    ingredients: Array<{
      materialId: string;
      materialName: string;
      required: number;
      available: number;
      unit: string;
      status: "sufficient" | "low" | "insufficient";
    }>;
  }> {
    const recipe = await recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    const ingredients = recipe.ingredients.map((ingredient) => {
      const required = Number(ingredient.quantity) * multiplier;
      const available = Number(ingredient.material.currentStock);
      let status: "sufficient" | "low" | "insufficient";

      if (available >= required) {
        status = "sufficient";
      } else if (available >= required * 0.5) {
        status = "low";
      } else {
        status = "insufficient";
      }

      return {
        materialId: ingredient.materialId,
        materialName: ingredient.material.name,
        required,
        available,
        unit: ingredient.unit,
        status,
      };
    });

    // Check if ALL materials have sufficient stock (available >= required)
    const isAvailable = ingredients.every((ing) => ing.available >= ing.required);

    return {
      isAvailable,
      ingredients,
    };
  }

  /**
   * Start production - creates batch and deducts materials from stock
   */
  async startProduction(data: {
    storeId: string;
    productId: string;
    recipeId: string;
    plannedQuantity: number;
    scheduledDate: Date;
    notes?: string;
  }): Promise<ProductionBatchWithRelations> {
    // Validate recipe exists and belongs to store
    const recipe = await recipeRepository.findById(data.recipeId);
    if (!recipe || recipe.storeId !== data.storeId) {
      throw new Error("Recipe not found or does not belong to this store");
    }

    // Validate product exists and belongs to store
    const product = await productRepository.findById(data.productId);
    if (!product || product.storeId !== data.storeId) {
      throw new Error("Product not found or does not belong to this store");
    }

    // Validate product and recipe are linked through RecipeProduct junction table
    const isLinked = await prisma.recipeProduct.findFirst({
      where: {
        productId: data.productId,
        recipeId: data.recipeId,
      },
    });

    if (!isLinked) {
      throw new Error(
        "Product and recipe are not linked. Please link the product to this recipe first."
      );
    }

    // Calculate batch multiplier
    const batchMultiplier = data.plannedQuantity / Number(recipe.yieldQuantity);

    // Check material availability
    const { isAvailable, ingredients } = await this.checkMaterialAvailability(
      data.recipeId,
      batchMultiplier
    );

    if (!isAvailable) {
      const insufficientMaterials = ingredients
        .filter((ing) => ing.status === "insufficient")
        .map((ing) => ing.materialName)
        .join(", ");
      throw new Error(`Insufficient materials: ${insufficientMaterials}`);
    }

    // Generate batch number
    const batchNumber = await productionBatchRepository.generateBatchNumber(data.storeId, "BATCH");

    // Start transaction with enhanced error handling and timeout
    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Create production batch
          const batch = await tx.productionBatch.create({
            data: {
              storeId: data.storeId,
              batchNumber,
              productId: data.productId,
              recipeId: data.recipeId,
              plannedQuantity: data.plannedQuantity,
              unit: recipe.yieldUnit,
              status: ProductionStatus.IN_PROGRESS,
              scheduledDate: data.scheduledDate,
              notes: data.notes || null,
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit: true,
                },
              },
              recipe: {
                select: {
                  id: true,
                  name: true,
                  yieldQuantity: true,
                  yieldUnit: true,
                  ingredients: {
                    include: {
                      material: {
                        select: {
                          id: true,
                          name: true,
                          currentStock: true,
                          unit: true,
                        },
                      },
                    },
                  },
                },
              },
              stockMovements: {
                select: {
                  id: true,
                  type: true,
                  quantity: true,
                  unit: true,
                  createdAt: true,
                },
              },
            },
          });

          // 2. Prepare batch operations for materials (optimize from N queries to 2 queries)
          const materialUpdates: Array<{ id: string; newStock: number }> = [];
          const stockMovements: Array<{
            materialId: string;
            productionBatchId: string;
            type: MovementType;
            quantity: number;
            unit: string;
            balanceAfter: number;
            notes: string;
          }> = [];

          // Fetch all materials in one query to validate existence
          const materialIds = recipe.ingredients.map((ing) => ing.materialId);
          const materials = await tx.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, currentStock: true, name: true },
          });

          // Create a map for quick lookup
          const materialMap = new Map(materials.map((m) => [m.id, m]));

          // Validate all materials exist and prepare updates
          for (const ingredient of recipe.ingredients) {
            const material = materialMap.get(ingredient.materialId);

            if (!material) {
              throw new Error(
                `Cannot start production: Material '${ingredient.material?.name || ingredient.materialId}' not found. Please check your recipe ingredients.`
              );
            }

            const deductionAmount = Number(ingredient.quantity) * batchMultiplier;
            const newBalance = Number(material.currentStock) - deductionAmount;

            materialUpdates.push({
              id: ingredient.materialId,
              newStock: newBalance,
            });

            stockMovements.push({
              materialId: ingredient.materialId,
              productionBatchId: batch.id,
              type: MovementType.PRODUCTION_OUT,
              quantity: deductionAmount,
              unit: ingredient.unit,
              balanceAfter: newBalance,
              notes: `Production batch ${batchNumber} - ${recipe.name}`,
            });
          }

          // 3. Batch update all materials (1 query per material, but parallel)
          await Promise.all(
            materialUpdates.map((update) =>
              tx.material.update({
                where: { id: update.id },
                data: { currentStock: update.newStock },
              })
            )
          );

          // 4. Batch create all stock movements (1 query)
          await tx.stockMovement.createMany({
            data: stockMovements,
          });

          return batch as ProductionBatchWithRelations;
        },
        {
          maxWait: 10000, // Maximum time to wait for transaction to start (10s)
          timeout: 20000, // Maximum time for transaction to complete (20s)
        }
      );
    } catch (error) {
      // Handle transaction-specific errors with user-friendly messages
      if (error instanceof Error) {
        // Prisma transaction timeout error
        if (error.message.includes("Transaction") && error.message.includes("not found")) {
          throw new Error(
            `Production start failed due to database timeout. This may be caused by high server load. Please try again in a moment.`
          );
        }

        // Connection pool exhaustion
        if (error.message.includes("Connection") || error.message.includes("pool")) {
          throw new Error(
            `Database connection unavailable. The server is currently busy. Please try again shortly.`
          );
        }

        // Statement timeout
        if (error.message.includes("statement timeout")) {
          throw new Error(
            `Production start took too long to complete. Please try again or contact support if the issue persists.`
          );
        }

        // Re-throw with original message if it's already a user-friendly error
        if (error.message.includes("Cannot start production") || error.message.includes("Insufficient materials")) {
          throw error;
        }
      }

      // Generic fallback error
      throw new Error(
        `Failed to start production batch. Please check your materials and try again. If the problem continues, contact support.`
      );
    }
  }

  /**
   * Complete production - adds finished products to stock
   */
  async completeProduction(
    batchId: string,
    storeId: string,
    actualQuantity: number
  ): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Get batch details
    const batch = await productionBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error("Production batch not found");
    }

    // Validate status
    if (batch.status !== ProductionStatus.IN_PROGRESS) {
      throw new Error("Only batches in progress can be completed");
    }

    // Start transaction with timeout
    return prisma.$transaction(
      async (tx) => {
        // 1. Get current product stock
        const product = await tx.product.findUnique({
          where: { id: batch.productId },
        });

        if (!product) {
          throw new Error("Product not found");
        }

        const newBalance = Number(product.currentStock) + actualQuantity;

        // 2. Update product stock
        await tx.product.update({
          where: { id: batch.productId },
          data: {
            currentStock: newBalance,
          },
        });

        // 3. Create stock movement record (PRODUCTION_IN for products)
        await tx.stockMovement.create({
          data: {
            productId: batch.productId,
            productionBatchId: batchId,
            type: MovementType.PRODUCTION_IN,
            quantity: actualQuantity,
            unit: batch.unit,
            balanceAfter: newBalance,
            notes: `Production batch ${batch.batchNumber} completed`,
          },
        });

        // 4. Update batch status
        const updatedBatch = await tx.productionBatch.update({
          where: { id: batchId },
          data: {
            status: ProductionStatus.COMPLETED,
            actualQuantity,
            completedDate: new Date(),
          },
        });

        return updatedBatch;
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );
  }

  /**
   * Cancel production - optionally restores materials to stock
   */
  async cancelProduction(
    batchId: string,
    storeId: string,
    restoreMaterials: boolean = false
  ): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Get batch details
    const batch = await productionBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error("Production batch not found");
    }

    // Validate status
    if (batch.status === ProductionStatus.COMPLETED) {
      throw new Error("Cannot cancel completed batches");
    }

    if (batch.status === ProductionStatus.CANCELLED) {
      throw new Error("Batch is already cancelled");
    }

    // Start transaction with timeout
    return prisma.$transaction(
      async (tx) => {
        // 1. If restoring materials, add them back to stock (optimized)
        if (restoreMaterials && batch.recipe) {
          const batchMultiplier = Number(batch.plannedQuantity) / Number(batch.recipe.yieldQuantity);

          // Prepare batch operations
          const materialUpdates: Array<{ id: string; newStock: number }> = [];
          const stockMovements: Array<{
            materialId: string;
            productionBatchId: string;
            type: MovementType;
            quantity: number;
            unit: string;
            balanceAfter: number;
            notes: string;
          }> = [];

          // Fetch all materials in one query
          const materialIds = batch.recipe.ingredients.map((ing) => ing.materialId);
          const materials = await tx.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, currentStock: true },
          });

          const materialMap = new Map(materials.map((m) => [m.id, m]));

          // Prepare restoration data
          for (const ingredient of batch.recipe.ingredients) {
            const material = materialMap.get(ingredient.materialId);
            if (!material) continue; // Skip if material no longer exists

            const restorationAmount = Number(ingredient.quantity) * batchMultiplier;
            const newBalance = Number(material.currentStock) + restorationAmount;

            materialUpdates.push({
              id: ingredient.materialId,
              newStock: newBalance,
            });

            stockMovements.push({
              materialId: ingredient.materialId,
              productionBatchId: batchId,
              type: MovementType.ADJUSTMENT,
              quantity: restorationAmount,
              unit: ingredient.unit,
              balanceAfter: newBalance,
              notes: `Production batch ${batch.batchNumber} cancelled - materials restored`,
            });
          }

          // Batch update materials (parallel)
          await Promise.all(
            materialUpdates.map((update) =>
              tx.material.update({
                where: { id: update.id },
                data: { currentStock: update.newStock },
              })
            )
          );

          // Batch create stock movements
          if (stockMovements.length > 0) {
            await tx.stockMovement.createMany({
              data: stockMovements,
            });
          }
        }

        // 2. Update batch status
        const updatedBatch = await tx.productionBatch.update({
          where: { id: batchId },
          data: {
            status: ProductionStatus.CANCELLED,
          },
        });

        return updatedBatch;
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );
  }

  /**
   * Update batch details (non-status fields)
   */
  async updateProductionBatch(
    batchId: string,
    storeId: string,
    data: {
      plannedQuantity?: number;
      scheduledDate?: Date;
      notes?: string;
    }
  ): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Convert number to Decimal if plannedQuantity is provided
    const updateData: any = {};
    if (data.plannedQuantity !== undefined) {
      updateData.plannedQuantity = new Prisma.Decimal(data.plannedQuantity);
    }
    if (data.scheduledDate !== undefined) {
      updateData.scheduledDate = data.scheduledDate;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    return productionBatchRepository.update(batchId, updateData);
  }

  /**
   * Delete production batch (only if not started)
   */
  async deleteProductionBatch(batchId: string, storeId: string): Promise<ProductionBatch> {
    // Verify batch belongs to store
    const belongsToStore = await productionBatchRepository.belongsToStore(batchId, storeId);
    if (!belongsToStore) {
      throw new Error("Production batch not found or does not belong to this store");
    }

    // Get batch to check status
    const batch = await productionBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error("Production batch not found");
    }

    // Only allow deletion of PLANNED batches
    if (batch.status !== ProductionStatus.PLANNED) {
      throw new Error("Can only delete planned batches. Cancel in-progress batches instead.");
    }

    return productionBatchRepository.delete(batchId);
  }

  /**
   * Get batches due soon (within date range)
   */
  async getBatchesDueSoon(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductionBatch[]> {
    return productionBatchRepository.getBatchesDueSoon(storeId, startDate, endDate);
  }
}

// Export singleton instance
export const productionBatchService = new ProductionBatchService();
