import {
  ProductionBatch,
  ProductionStatus,
  ProductionTriggerType,
  MovementType,
  OrderItemStatus,
  Prisma,
} from "@prisma/client";
import { advanceOrderToReadyIfAllItemsReady } from "./order-status.helpers";
import {
  productionBatchRepository,
  ProductionBatchWithRelations,
  ProductionBatchFilters,
} from "../repositories/production-batch.repository";
import { recipeRepository } from "../repositories/recipe.repository";
import { materialRepository } from "../repositories/material.repository";
import { productRepository } from "../repositories/product.repository";
import { prisma } from "../prisma";
import { convertStockToIngredientUnit } from "../utils/unit-conversion";

/**
 * Production Batch Service
 *
 * Business logic layer for production batch operations.
 * Handles material validation, stock movements, and production workflows.
 */
export class ProductionBatchService {
  /**
   * Calculate batch multiplier based on planned quantity and recipe yield
   * @param plannedQuantity - Total planned quantity (units)
   * @param yieldQuantity - Recipe yield per batch (units)
   * @returns Batch multiplier (how many batches)
   */
  private calculateBatchMultiplier(plannedQuantity: number, yieldQuantity: number): number {
    return plannedQuantity / Number(yieldQuantity);
  }

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
      // Convert material stock to ingredient unit for proper comparison
      const materialStock = Number(ingredient.material.currentStock);
      const materialUnit = ingredient.material.unit;
      const ingredientUnit = ingredient.unit;
      const available = convertStockToIngredientUnit(materialStock, materialUnit, ingredientUnit);

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
    const batchMultiplier = this.calculateBatchMultiplier(
      Number(data.plannedQuantity),
      Number(recipe.yieldQuantity)
    );

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

            // Recipe ingredient quantity is in ingredient.unit (e.g., g)
            // Material stock is in material.unit (e.g., kg)
            // We need to convert the deduction to material's unit
            const deductionInIngredientUnit = Number(ingredient.quantity) * batchMultiplier;
            // Convert deduction from ingredient unit to material unit
            // ingredient.material.unit comes from RecipeWithIngredients type
            const materialUnit = ingredient.material.unit;
            const deductionAmount = convertStockToIngredientUnit(
              deductionInIngredientUnit,
              ingredient.unit,
              materialUnit
            );
            const currentStock = Number(material.currentStock);
            const newBalance = currentStock - deductionAmount;

            // CRITICAL: Prevent negative stock - validate within transaction
            if (newBalance < 0) {
              throw new Error(
                `Insufficient stock for material '${material.name}'. Required: ${deductionAmount.toFixed(2)} ${materialUnit}, Available: ${currentStock.toFixed(2)} ${materialUnit}.`
              );
            }

            materialUpdates.push({
              id: ingredient.materialId,
              newStock: newBalance,
            });

            // Store movement record in material's unit
            stockMovements.push({
              materialId: ingredient.materialId,
              productionBatchId: batch.id,
              type: MovementType.PRODUCTION_OUT,
              quantity: deductionAmount,
              unit: materialUnit,
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
        if (
          error.message.includes("Cannot start production") ||
          error.message.includes("Insufficient materials")
        ) {
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

    // ORDER_SHORTFALL batches never moved stock in the first place (the
    // order's own SALE deduction already covers the full ordered quantity —
    // see stock-deduction.service.ts and draftShortfallBatchesForOrder
    // below) — completing one is purely a task-completion + KDS signal, not
    // an inventory event, or it would double-count the stock impact.
    if (batch.triggerType === ProductionTriggerType.ORDER_SHORTFALL) {
      return prisma.$transaction(async (tx) => {
        const updatedBatch = await tx.productionBatch.update({
          where: { id: batchId },
          data: {
            status: ProductionStatus.COMPLETED,
            actualQuantity,
            completedDate: new Date(),
          },
        });

        const linkedItems = await tx.orderItem.findMany({
          where: { productionBatchId: batchId },
          select: { id: true, orderId: true, status: true },
        });

        const affectedOrderIds = new Set<string>();
        for (const item of linkedItems) {
          if (item.status === OrderItemStatus.READY || item.status === OrderItemStatus.SERVED) {
            continue;
          }
          await tx.orderItem.update({
            where: { id: item.id },
            data: { status: OrderItemStatus.READY, preparedAt: new Date() },
          });
          affectedOrderIds.add(item.orderId);
        }

        for (const orderId of affectedOrderIds) {
          await advanceOrderToReadyIfAllItemsReady(tx, orderId);
        }

        return updatedBatch;
      });
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

    // ORDER_SHORTFALL batches never deducted materials (see completeProduction
    // above) — restoring them here would incorrectly add stock that was never
    // taken, regardless of what the caller passed.
    if (batch.triggerType === ProductionTriggerType.ORDER_SHORTFALL) {
      restoreMaterials = false;
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
          const batchMultiplier = this.calculateBatchMultiplier(
            Number(batch.plannedQuantity),
            Number(batch.recipe.yieldQuantity)
          );

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

            // Convert restoration amount from ingredient unit to material unit
            const restorationInIngredientUnit = Number(ingredient.quantity) * batchMultiplier;
            // ingredient.material.unit comes from ProductionBatchWithRelations type
            const materialUnit = ingredient.material.unit;
            const restorationAmount = convertStockToIngredientUnit(
              restorationInIngredientUnit,
              ingredient.unit,
              materialUnit
            );
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
              unit: materialUnit,
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

  /**
   * Auto-draft ORDER_SHORTFALL production batches for a newly confirmed
   * order — one per recipe-linked product whose on-hand currentStock
   * doesn't cover what was just ordered, linking the batch to the triggering
   * OrderItem(s) so completing it flips them to READY (see completeProduction
   * and the KDS item-status route).
   *
   * Must be called with PRE-deduction stock numbers — i.e. before
   * deductStockForOrder runs for the same order — or the shortfall would be
   * computed against stock this same order already ate into. Never mutates
   * Material/Product stock itself; that still happens exactly as before, via
   * the normal SALE deduction at delivery (or immediately for online
   * payments) — this is purely a task/tracking record.
   *
   * Only products with a default Recipe can auto-produce; a plain
   * finished-goods product with no recipe just runs out, same as today.
   */
  async draftShortfallBatchesForOrder(
    orderId: string,
    storeId: string
  ): Promise<{ batchesCreated: number }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { status: { not: OrderItemStatus.CANCELLED } },
          include: {
            product: {
              include: {
                recipeProducts: {
                  where: { isDefault: true },
                  include: { recipe: { select: { id: true, yieldUnit: true } } },
                },
              },
            },
            menuItem: {
              include: {
                product: {
                  include: {
                    recipeProducts: {
                      where: { isDefault: true },
                      include: { recipe: { select: { id: true, yieldUnit: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order || order.storeId !== storeId) return { batchesCreated: 0 };

    interface ShortfallCandidate {
      productId: string;
      currentStock: number;
      recipeId: string;
      yieldUnit: string;
      orderedQty: number;
      itemIds: string[];
    }
    const byProduct = new Map<string, ShortfallCandidate>();

    for (const item of order.items) {
      const product = item.product ?? item.menuItem?.product;
      if (!product) continue;
      const defaultRecipeProduct = product.recipeProducts[0];
      if (!defaultRecipeProduct?.recipe) continue; // no recipe = no way to auto-produce more

      const existing = byProduct.get(product.id);
      if (existing) {
        existing.orderedQty += Number(item.quantity);
        existing.itemIds.push(item.id);
      } else {
        byProduct.set(product.id, {
          productId: product.id,
          currentStock: Number(product.currentStock),
          recipeId: defaultRecipeProduct.recipe.id,
          yieldUnit: defaultRecipeProduct.recipe.yieldUnit,
          orderedQty: Number(item.quantity),
          itemIds: [item.id],
        });
      }
    }

    let batchesCreated = 0;

    for (const entry of byProduct.values()) {
      const shortfall = entry.orderedQty - entry.currentStock;
      if (shortfall <= 0) continue;

      const batchNumber = await productionBatchRepository.generateBatchNumber(storeId, "ORD");

      await prisma.$transaction(async (tx) => {
        const batch = await tx.productionBatch.create({
          data: {
            storeId,
            batchNumber,
            productId: entry.productId,
            recipeId: entry.recipeId,
            plannedQuantity: shortfall,
            unit: entry.yieldUnit,
            status: ProductionStatus.IN_PROGRESS,
            triggerType: ProductionTriggerType.ORDER_SHORTFALL,
            scheduledDate: new Date(),
            notes: `Auto-drafted — order ${order.orderNumber} needed more than was on hand`,
          },
        });

        await tx.orderItem.updateMany({
          where: { id: { in: entry.itemIds } },
          data: { productionBatchId: batch.id },
        });
      });

      batchesCreated++;
    }

    return { batchesCreated };
  }
}

// Export singleton instance
export const productionBatchService = new ProductionBatchService();
