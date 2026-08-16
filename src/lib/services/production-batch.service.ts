import {
  ProductionBatch,
  ProductionStatus,
  ProductionTriggerType,
  MovementType,
  OrderItemStatus,
  StockMode,
  Department,
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
import { convertUnit } from "../utils/unit-conversion";
import { publishStoreEvent, publishStockChanged } from "../realtime/publish";
import { REALTIME_EVENTS } from "../realtime/channels";
import { fireLowStockAlertsForEntities } from "./stock-alerts.helpers";
import { roundStock } from "./stock-precision";
import { ValidationError, NotFoundError } from "@/lib/errors";

/**
 * The primary recipe, for shortfall drafting. `storeId` is selected because the
 * FK is global and a cross-store primary must never drive production.
 */
const shortfallRecipeInclude = {
  primaryRecipe: { select: { id: true, yieldUnit: true, storeId: true } },
} satisfies Prisma.ProductInclude;

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
   * Record that a sale drew raw materials for BATCH_PRODUCED quantity sold
   * beyond the counted balance (the made-to-order fallback in
   * stock-deduction.service.ts).
   *
   * Attaches to the order's existing IN_PROGRESS ORDER_SHORTFALL batch for that
   * product where one exists — drafted at CONFIRMED by
   * draftShortfallBatchesForOrder — so one physical bake is never recorded
   * twice. Creates one otherwise, but ONLY when the store has Production
   * enabled: a store with it switched off must not accrue records it can never
   * see or act on.
   *
   * Setting `materialsDrawnAt` is the marker that this batch's raw materials
   * have ALREADY left inventory. It is null on every pre-release row, which is
   * exactly why settlement can key off it with no backfill.
   */
  async recordDrawnShortfalls(
    orderId: string,
    storeId: string,
    shortfalls: { productId: string; quantity: number }[]
  ): Promise<void> {
    if (shortfalls.length === 0) return;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { productionEnabled: true },
    });
    if (!store?.productionEnabled) return;

    for (const shortfall of shortfalls) {
      const existing = await prisma.productionBatch.findFirst({
        where: {
          storeId,
          productId: shortfall.productId,
          triggerType: ProductionTriggerType.ORDER_SHORTFALL,
          status: ProductionStatus.IN_PROGRESS,
          orderItems: { some: { orderId } },
        },
        select: { id: true, materialsDrawnAt: true },
      });

      if (existing) {
        if (existing.materialsDrawnAt === null) {
          await prisma.productionBatch.update({
            where: { id: existing.id },
            data: { materialsDrawnAt: new Date() },
          });
        }
        continue;
      }

      const product = await prisma.product.findFirst({
        where: { id: shortfall.productId, storeId },
        select: { unit: true, primaryRecipeId: true },
      });
      if (!product) continue;

      const batchNumber = await productionBatchRepository.generateBatchNumber(storeId, "ORD");
      await prisma.productionBatch.create({
        data: {
          storeId,
          batchNumber,
          productId: shortfall.productId,
          recipeId: product.primaryRecipeId,
          plannedQuantity: shortfall.quantity,
          unit: product.unit,
          status: ProductionStatus.IN_PROGRESS,
          triggerType: ProductionTriggerType.ORDER_SHORTFALL,
          scheduledDate: new Date(),
          materialsDrawnAt: new Date(),
          notes: "Sold before it was prepped — ingredients already taken out at the sale",
        },
      });
    }
  }

  /**
   * Outstanding "already paid for in ingredients" debt for a product:
   *   Σ (plannedQuantity − settledQuantity) over ORDER_SHORTFALL batches with
   *   materialsDrawnAt != null and status != CANCELLED.
   */
  async getOutstandingDrawnShortfall(productId: string): Promise<number> {
    const batches = await prisma.productionBatch.findMany({
      where: {
        productId,
        triggerType: ProductionTriggerType.ORDER_SHORTFALL,
        materialsDrawnAt: { not: null },
        status: { not: ProductionStatus.CANCELLED },
      },
      select: { plannedQuantity: true, settledQuantity: true },
    });
    return batches.reduce(
      (sum, b) => sum + Math.max(0, Number(b.plannedQuantity) - Number(b.settledQuantity)),
      0
    );
  }

  /**
   * Net a new production run against outstanding drawn-shortfall debt, oldest
   * batch first, and return how much of `quantity` was absorbed.
   *
   * Callers deduct materials for (quantity − settled) only, because the settled
   * portion's ingredients already left inventory when the item was sold ahead of
   * being prepped. Without this, logging prep that the fallback already
   * accounted for draws the same flour twice AND creates phantom finished goods.
   */
  async settleDrawnShortfall(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<number> {
    if (quantity <= 0) return 0;

    const batches = await tx.productionBatch.findMany({
      where: {
        productId,
        triggerType: ProductionTriggerType.ORDER_SHORTFALL,
        materialsDrawnAt: { not: null },
        status: { not: ProductionStatus.CANCELLED },
      },
      select: { id: true, plannedQuantity: true, settledQuantity: true },
      orderBy: { createdAt: "asc" },
    });

    let remaining = quantity;
    let settled = 0;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const outstanding = Number(batch.plannedQuantity) - Number(batch.settledQuantity);
      if (outstanding <= 0) continue;

      const take = Math.min(outstanding, remaining);
      await tx.productionBatch.update({
        where: { id: batch.id },
        data: { settledQuantity: { increment: take } },
      });
      remaining -= take;
      settled += take;
    }

    return settled;
  }

  /**
   * Today's prep list: for every BATCH_PRODUCED product with a primary recipe,
   * how many units are needed to reach its par level (`minStock`).
   *
   * Netted against outstanding drawn-shortfall debt, because that debt
   * represents food already SOLD whose ingredients already left — it is not
   * stock the kitchen still needs to build back up, and counting it twice would
   * inflate every suggestion.
   */
  async getPrepList(storeId: string): Promise<
    Array<{
      productId: string;
      name: string;
      department: Department;
      unit: string;
      currentStock: number;
      parLevel: number;
      suggested: number;
      outstandingShortfall: number;
      recipeId: string;
      recipeName: string;
    }>
  > {
    const products = await prisma.product.findMany({
      where: {
        storeId,
        stockMode: StockMode.BATCH_PRODUCED,
        primaryRecipeId: { not: null },
      },
      select: {
        id: true,
        name: true,
        department: true,
        unit: true,
        currentStock: true,
        minStock: true,
        primaryRecipe: { select: { id: true, name: true, storeId: true } },
      },
      orderBy: { name: "asc" },
    });

    const rows = [];
    for (const product of products) {
      // The FK is global; never surface another store's recipe as prep work.
      if (!product.primaryRecipe || product.primaryRecipe.storeId !== storeId) continue;

      const currentStock = Number(product.currentStock);
      const parLevel = Number(product.minStock);
      const outstandingShortfall = await this.getOutstandingDrawnShortfall(product.id);

      // Below par by this much, minus what has already been paid for in
      // ingredients but not yet logged.
      const gap = parLevel - currentStock;
      const suggested = Math.max(0, gap - outstandingShortfall);
      if (suggested <= 0 && outstandingShortfall <= 0) continue;

      rows.push({
        productId: product.id,
        name: product.name,
        department: product.department,
        unit: product.unit,
        currentStock,
        parLevel,
        suggested,
        outstandingShortfall,
        recipeId: product.primaryRecipe.id,
        recipeName: product.primaryRecipe.name,
      });
    }

    return rows;
  }

  /**
   * End-of-day count sheet: reconcile what the books say against what is
   * physically on the shelf, one ADJUSTMENT per discrepancy.
   *
   * This is the ONLY mechanism that expenses finished-goods shrinkage under a
   * sale-recognised COGS model. Without it, 40 croissants produced, 60 of 100
   * sold and 40 quietly binned are never costed at all — the ingredients left
   * at production, the sales booked their own cost, and the gap just evaporates
   * from the books.
   *
   * Counts are applied verbatim, including a count of zero and a count that
   * moves stock DOWN — that is the whole point. Rows whose counted figure
   * already matches are skipped so the ledger does not fill with no-ops.
   */
  async applyStockCount(
    storeId: string,
    counts: Array<{ productId: string; countedQuantity: number }>
  ): Promise<{ adjusted: number; skipped: number }> {
    if (counts.length === 0) return { adjusted: 0, skipped: 0 };

    const products = await prisma.product.findMany({
      where: {
        id: { in: counts.map((c) => c.productId) },
        storeId,
        stockMode: StockMode.BATCH_PRODUCED,
      },
      select: { id: true, name: true, unit: true, currentStock: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let adjusted = 0;
    let skipped = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const count of counts) {
          const product = byId.get(count.productId);
          // Silently ignoring an unknown id would let a stale tab zero a
          // product it should not touch; skipping is the safe read.
          if (!product) {
            skipped++;
            continue;
          }

          const counted = roundStock(count.countedQuantity);
          const onBooks = Number(product.currentStock);
          const delta = roundStock(counted - onBooks);
          if (delta === 0) {
            skipped++;
            continue;
          }

          const updated = await tx.product.update({
            where: { id: product.id },
            data: { currentStock: counted },
            select: { currentStock: true },
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: MovementType.ADJUSTMENT,
              quantity: delta,
              unit: product.unit,
              balanceAfter: updated.currentStock,
              reason: "STOCK_COUNT",
              notes: `Counted ${counted}, books said ${onBooks}`,
            },
          });
          adjusted++;
        }
      },
      { maxWait: 10000, timeout: 20000 }
    );

    if (adjusted > 0) {
      publishStockChanged(storeId, { productIds: counts.map((c) => c.productId) });
    }

    return { adjusted, skipped };
  }

  /**
   * One-tap "we made N of these" — the whole start/complete cycle in a single
   * transaction.
   *
   * The existing flow is a four-field StartProductionDialog plus a separate
   * Complete step, and that friction is precisely why prep goes unlogged, which
   * is what makes finished-goods counts drift in the first place.
   *
   * Settlement-aware in BOTH directions: materials are drawn only for the part
   * that was not already paid for at the till, and finished goods are credited
   * only for the part still physically on the shelf.
   */
  async quickLogProduction(data: {
    storeId: string;
    productId: string;
    quantity: number;
  }): Promise<ProductionBatch> {
    if (!(data.quantity > 0)) {
      throw new ValidationError("Quantity must be greater than zero");
    }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, storeId: data.storeId },
      select: {
        id: true,
        name: true,
        unit: true,
        stockMode: true,
        primaryRecipeId: true,
        primaryRecipe: {
          select: {
            id: true,
            storeId: true,
            yieldQuantity: true,
            yieldUnit: true,
            ingredients: { include: { material: true } },
          },
        },
      },
    });

    if (!product) throw new NotFoundError("Product not found in this store");
    if (product.stockMode !== StockMode.BATCH_PRODUCED) {
      throw new ValidationError(
        "Only products you count on a shelf can be logged as a production run"
      );
    }
    const recipe = product.primaryRecipe;
    if (!recipe || recipe.storeId !== data.storeId) {
      throw new ValidationError("This product has no primary recipe to produce from");
    }
    if (!(Number(recipe.yieldQuantity) > 0)) {
      throw new ValidationError("This recipe has no usable yield quantity");
    }

    const batchNumber = await productionBatchRepository.generateBatchNumber(data.storeId, "QUICK");

    const batch = await prisma.$transaction(
      async (tx) => {
        const settled = await this.settleDrawnShortfall(tx, data.productId, data.quantity);

        // One figure, two distinct reasons it is the right one — bake 10
        // against a debt of 3 and `unsettled` is 7 for both:
        //   MATERIALS: the 3 already had their ingredients drawn at the till,
        //   so only 7 more leave now.
        //   FINISHED GOODS: the 3 go straight to the customers who already
        //   bought them, so only 7 land on the shelf.
        const unsettled = Math.max(0, data.quantity - settled);

        const created = await tx.productionBatch.create({
          data: {
            storeId: data.storeId,
            batchNumber,
            productId: data.productId,
            recipeId: recipe.id,
            plannedQuantity: data.quantity,
            actualQuantity: data.quantity,
            settledQuantity: settled,
            unit: product.unit,
            status: ProductionStatus.COMPLETED,
            triggerType: ProductionTriggerType.MANUAL,
            scheduledDate: new Date(),
            completedDate: new Date(),
            notes: "Logged from the prep list",
          },
        });

        // ---- Materials out, for the unsettled portion only.
        const multiplier = unsettled / Number(recipe.yieldQuantity);
        if (multiplier > 0) {
          for (const ing of recipe.ingredients) {
            const raw = convertUnit(
              Number(ing.quantity) * multiplier,
              ing.unit,
              ing.material.unit
            );
            const qty = roundStock(raw);
            if (qty <= 0) continue;

            const updated = await tx.material.update({
              where: { id: ing.materialId },
              data: { currentStock: { decrement: qty } },
              select: { currentStock: true },
            });
            await tx.stockMovement.create({
              data: {
                materialId: ing.materialId,
                productionBatchId: created.id,
                type: MovementType.PRODUCTION_OUT,
                quantity: qty,
                unit: ing.material.unit,
                balanceAfter: updated.currentStock,
                notes: `Quick log ${batchNumber} — ${product.name}`,
              },
            });
          }
        }

        // ---- Finished goods in, for what is actually left on the shelf.
        if (unsettled > 0) {
          const updated = await tx.product.update({
            where: { id: data.productId },
            data: { currentStock: { increment: roundStock(unsettled) } },
            select: { currentStock: true },
          });
          await tx.stockMovement.create({
            data: {
              productId: data.productId,
              productionBatchId: created.id,
              type: MovementType.PRODUCTION_IN,
              quantity: roundStock(unsettled),
              unit: product.unit,
              balanceAfter: updated.currentStock,
              notes: `Quick log ${batchNumber} — ${product.name}`,
            },
          });
        }

        return created;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    publishStockChanged(data.storeId, {
      productIds: [data.productId],
      materialIds: recipe.ingredients.map((i) => i.materialId),
    });
    publishStoreEvent(data.storeId, REALTIME_EVENTS.PRODUCT_CHANGED, {
      action: "updated",
      entityId: data.productId,
    });

    await fireLowStockAlertsForEntities(
      data.storeId,
      recipe.ingredients.map((i) => ({
        entityId: i.materialId,
        entityType: "material" as const,
      }))
    );

    return batch;
  }

  /**
   * Inverse of `settleDrawnShortfall` — hand absorbed debt back when the run
   * that absorbed it is cancelled.
   *
   * Newest-settled first, so repeatedly starting and cancelling a run leaves the
   * ledger where it began instead of drifting. Without this, cancelling a run
   * that netted against a debt silently writes that debt off, and the store ends
   * up permanently ahead on material it never had.
   */
  async releaseDrawnShortfall(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<number> {
    if (quantity <= 0) return 0;

    const batches = await tx.productionBatch.findMany({
      where: {
        productId,
        triggerType: ProductionTriggerType.ORDER_SHORTFALL,
        materialsDrawnAt: { not: null },
        status: { not: ProductionStatus.CANCELLED },
        settledQuantity: { gt: 0 },
      },
      select: { id: true, settledQuantity: true },
      orderBy: { createdAt: "desc" },
    });

    let remaining = quantity;
    let released = 0;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const give = Math.min(Number(batch.settledQuantity), remaining);
      if (give <= 0) continue;

      await tx.productionBatch.update({
        where: { id: batch.id },
        data: { settledQuantity: { decrement: give } },
      });
      remaining -= give;
      released += give;
    }

    return released;
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
      const available = convertUnit(materialStock, materialUnit, ingredientUnit);

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
    // Net this run against any "already paid for in ingredients" debt before
    // sizing the material draw. When an item sold past its counted balance, the
    // sale ALREADY took that portion's ingredients out (see
    // stock-deduction.service.ts and recordDrawnShortfalls). Logging the prep
    // run afterwards must not take them out a second time — which, once the
    // prep list makes logging easy, becomes the NORMAL sequence rather than an
    // edge case.
    const outstandingShortfall = await this.getOutstandingDrawnShortfall(data.productId);
    const settledQty = Math.min(Number(data.plannedQuantity), outstandingShortfall);

    // Conservative estimate, used only for the availability check below. The
    // authoritative multiplier is recomputed inside the transaction from what
    // settlement actually absorbed.
    const estimatedMultiplier = this.calculateBatchMultiplier(
      Number(data.plannedQuantity) - settledQty,
      Number(recipe.yieldQuantity)
    );

    // Check material availability
    const { isAvailable, ingredients } = await this.checkMaterialAvailability(
      data.recipeId,
      estimatedMultiplier
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
    let startedBatch: ProductionBatchWithRelations;
    try {
      startedBatch = await prisma.$transaction(
        async (tx) => {
          // 0. Consume the drawn-shortfall debt this run is covering, inside the
          // same transaction as the material deduction so the two can never
          // diverge.
          //
          // The draw is sized from what settlement ACTUALLY absorbed, not from
          // the pre-transaction estimate: another run committing in between
          // could have taken part of the same debt, and trusting the stale
          // figure would under-deduct materials for the difference. The
          // estimate is still fine for the availability check above, which only
          // needs to be conservative.
          const actualSettled =
            settledQty > 0 ? await this.settleDrawnShortfall(tx, data.productId, settledQty) : 0;
          const batchMultiplier = this.calculateBatchMultiplier(
            Number(data.plannedQuantity) - actualSettled,
            Number(recipe.yieldQuantity)
          );

          // 1. Create production batch
          const batch = await tx.productionBatch.create({
            data: {
              storeId: data.storeId,
              batchNumber,
              productId: data.productId,
              recipeId: data.recipeId,
              plannedQuantity: data.plannedQuantity,
              // How much of THIS run was already sold (and already had its
              // ingredients taken) before it was logged. completeProduction
              // subtracts it before crediting finished goods, and
              // cancelProduction subtracts it before restoring materials —
              // without that, the settled portion becomes phantom stock.
              settledQuantity: actualSettled,
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
            const deductionAmount = convertUnit(
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

    // Materials were just decremented — tell every connected /management,
    // /data and /production view to refetch. Deliberately outside the
    // try/$transaction above: a rolled-back batch must not push a change that
    // never landed, and a failed push must not be reported as a failed batch.
    const deductedMaterialIds = recipe.ingredients.map((ing) => ing.materialId);
    publishStockChanged(data.storeId, { materialIds: deductedMaterialIds });

    // Same LOW_STOCK/CRITICAL_STOCK alert a sale raises — a recipe run that
    // empties a material is just as much a reorder signal. Never throws.
    await fireLowStockAlertsForEntities(
      data.storeId,
      deductedMaterialIds.map((materialId) => ({
        entityId: materialId,
        entityType: "material" as const,
      }))
    );

    return startedBatch;
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
    const completedBatch = await prisma.$transaction(
      async (tx) => {
        // 1. Get current product stock
        const product = await tx.product.findUnique({
          where: { id: batch.productId },
        });

        if (!product) {
          throw new Error("Product not found");
        }

        // Credit only what is physically left on the shelf. `settledQuantity`
        // is the part of this run that had already been SOLD before it was
        // logged — its ingredients came out at the sale, and the food went
        // straight to the customer. Adding the full `actualQuantity` would
        // invent that many units of stock that nobody can serve: bake 10
        // against a debt of 3 and the shelf holds 7, not 10.
        const settled = Number(batch.settledQuantity ?? 0);
        const creditedQuantity = Math.max(0, actualQuantity - settled);
        const newBalance = Number(product.currentStock) + creditedQuantity;

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

    // Finished-goods stock went UP — push after commit so the Products/Data
    // views reflect it without waiting for the 30s poll. PRODUCT_CHANGED too,
    // since the product row itself (its currentStock column) changed and the
    // product list listens on that event, not on STOCK_CHANGED.
    publishStockChanged(storeId, { productIds: [batch.productId] });
    publishStoreEvent(storeId, REALTIME_EVENTS.PRODUCT_CHANGED, {
      action: "updated",
      entityId: batch.productId,
    });

    // No low-stock check here on purpose: completing a batch only ever adds
    // stock, so nothing can cross a minimum downwards.

    return completedBatch;
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

    // Ids of the materials actually credited back inside the transaction
    // below, collected so the post-commit push knows exactly what moved
    // (a recipe ingredient whose material was since deleted is skipped).
    const restoredMaterialIds: string[] = [];

    // Start transaction with timeout
    const cancelledBatch = await prisma.$transaction(
      async (tx) => {
        // 1. If restoring materials, add them back to stock (optimized)
        if (restoreMaterials && batch.recipe) {
          // Restore only what this run actually DREW. `settledQuantity` was
          // netted out at startProduction because those ingredients had already
          // left at the sale, so restoring against the full `plannedQuantity`
          // would credit back materials that never left — and, because the
          // absorbed debt is released separately below, would otherwise write
          // that debt off at the same time, leaving the store permanently up on
          // phantom material.
          const settled = Number(batch.settledQuantity ?? 0);
          const drawnQuantity = Math.max(0, Number(batch.plannedQuantity) - settled);

          // Hand the debt back so the next production run nets against it again.
          if (settled > 0) {
            await this.releaseDrawnShortfall(tx, batch.productId, settled);
            await tx.productionBatch.update({
              where: { id: batchId },
              data: { settledQuantity: 0 },
            });
          }

          const batchMultiplier = this.calculateBatchMultiplier(
            drawnQuantity,
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
            const restorationAmount = convertUnit(
              restorationInIngredientUnit,
              ingredient.unit,
              materialUnit
            );
            const newBalance = Number(material.currentStock) + restorationAmount;

            materialUpdates.push({
              id: ingredient.materialId,
              newStock: newBalance,
            });
            restoredMaterialIds.push(ingredient.materialId);

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

    // Only after the restore actually committed. No low-stock check: a
    // cancellation credits stock back, it can't push anything under its
    // minimum.
    if (restoredMaterialIds.length > 0) {
      publishStockChanged(storeId, { materialIds: restoredMaterialIds });
    }

    return cancelledBatch;
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
            product: { include: shortfallRecipeInclude },
            menuItem: { include: { product: { include: shortfallRecipeInclude } } },
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

      // Only a counted product can run short. A MADE_TO_ORDER product has no
      // balance to fall below, and an UNTRACKED one at stock 0 would otherwise
      // draft a phantom batch on every single order, forever.
      if (product.stockMode !== StockMode.BATCH_PRODUCED) continue;

      const recipe = product.primaryRecipe;
      if (!recipe) continue; // no recipe = no way to auto-produce more
      // The FK is global; a cross-store primary must never drive production here.
      if (recipe.storeId !== storeId) continue;

      const existing = byProduct.get(product.id);
      if (existing) {
        existing.orderedQty += Number(item.quantity);
        existing.itemIds.push(item.id);
      } else {
        byProduct.set(product.id, {
          productId: product.id,
          currentStock: Number(product.currentStock),
          recipeId: recipe.id,
          yieldUnit: recipe.yieldUnit,
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
