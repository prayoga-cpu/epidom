import { prisma } from "@/lib/prisma";
import { MovementType, OrderItemStatus } from "@prisma/client";
import { toDecimal } from "@/lib/utils/types.server";
import { convertUnit } from "@/lib/utils/unit-conversion";
import { publishStockChanged } from "@/lib/realtime/publish";
import { fireLowStockAlert } from "@/lib/services/stock-alerts.helpers";

/**
 * Deduct stock when an order is purchased/confirmed.
 *
 * For each order item:
 *   1. Resolve a Product (via direct productId or via menuItem.productId).
 *   2. Decrement the product's OWN finished-goods stock (Product.currentStock)
 *      by the ordered quantity, and record a product StockMovement.
 *   3. If the product has a default Recipe, additionally scale its ingredients by
 *      (orderedQty / recipe.yieldQuantity) and subtract from each material's stock,
 *      recording a material StockMovement per ingredient.
 *   4. Fire LOW_STOCK / CRITICAL_STOCK alerts for anything that drops below its
 *      minimum threshold.
 *
 * Idempotent: if a SALE StockMovement already exists for this order, the call is a
 * no-op. This makes it safe to invoke from multiple lifecycle points (cash order
 * creation, payment webhook, POS delivery) and on webhook retries without
 * double-deducting.
 *
 * All stock writes for an order run in a single serializable transaction to
 * prevent oversell from concurrent reads of stale stock.
 */
export async function deductStockForOrder(
  orderId: string,
  storeId: string
): Promise<{ deducted: number; skipped: number; alreadyDeducted?: boolean }> {
  // Idempotency guard — if we already deducted for this order, do nothing.
  const existingMovement = await prisma.stockMovement.findFirst({
    where: { orderId, type: MovementType.SALE },
    select: { id: true },
  });
  if (existingMovement) {
    return { deducted: 0, skipped: 0, alreadyDeducted: true };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeProducts: {
                where: { isDefault: true },
                include: {
                  recipe: {
                    include: {
                      ingredients: {
                        include: { material: true },
                      },
                    },
                  },
                },
              },
            },
          },
          menuItem: {
            include: {
              product: {
                include: {
                  recipeProducts: {
                    where: { isDefault: true },
                    include: {
                      recipe: {
                        include: {
                          ingredients: {
                            include: { material: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      store: { select: { business: { select: { userId: true } } } },
    },
  });

  if (!order || order.storeId !== storeId) return { deducted: 0, skipped: 0 };

  const userId = order.store.business.userId;

  // A line item cancelled via KDS (e.g. "out of stock", kitchen mistake) must not
  // consume stock even though the order as a whole still reaches DELIVERED.
  const activeItems = order.items.filter((item) => item.status !== OrderItemStatus.CANCELLED);

  // Pre-compute deductions outside the transaction so we can log skips first.
  type ProductDeduction = {
    productId: string;
    productName: string;
    unit: string;
    minStock: number;
    orderedQty: number;
    newStock: number;
  };
  type MaterialDeduction = {
    materialId: string;
    materialName: string;
    materialUnit: string;
    minStock: number;
    needed: number;
    newStock: number;
    unit: string;
  };

  // Aggregate per product / per material BEFORE computing new stock. Duplicate
  // line items (e.g. the same product on two lines with different modifiers) and
  // materials shared across recipes must be SUMMED into a single deduction.
  // Computing each from the same stale currentStock and writing absolute values
  // would otherwise let the last write win and under-deduct (oversell).
  const productAgg = new Map<
    string,
    { productName: string; unit: string; minStock: number; currentStock: number; totalQty: number }
  >();
  const materialAgg = new Map<
    string,
    {
      materialName: string;
      materialUnit: string;
      minStock: number;
      currentStock: number;
      totalNeeded: number;
      unit: string;
    }
  >();
  let skipped = 0;

  // Frozen per-line COGS snapshot — Product.costPrice is already the
  // authoritative per-unit cost (recipe-derived or manually overridden, see
  // the Products page), so it's reused as-is rather than re-deriving cost
  // from raw ingredient prices here. Keyed by OrderItem.id since one
  // material/product StockMovement below is aggregated across items, but
  // this snapshot is per-line. Items with no resolvable product (skipped
  // above) simply have no entry, leaving OrderItem.unitCostSnapshot null.
  const itemCostSnapshots = new Map<string, number>();

  for (const item of activeItems) {
    const product = item.product ?? item.menuItem?.product;
    if (!product) {
      console.warn(
        `[stock-deduction] orderId=${orderId} itemId=${item.id}: no product found, skipping`
      );
      skipped++;
      continue;
    }

    itemCostSnapshots.set(item.id, Number(product.costPrice));

    // Untracked products (Product.trackStock === false) have no inventory at
    // all — a service like a haircut, or an always-available made-to-order
    // item — so there's no finished-goods stock and no recipe to deduct.
    // Defaults true for every product, so this only ever skips something an
    // owner has explicitly marked untracked. Deliberately not counted in
    // `skipped` (that counter means "unresolvable product," a data problem;
    // this is an intentional, expected exclusion) — the cost snapshot above
    // still applies so Finance margin reporting works for these too.
    if (!product.trackStock) continue;

    const orderedQty = Number(item.quantity);

    // 1. Always decrement the product's own finished-goods stock.
    const existingProduct = productAgg.get(product.id);
    if (existingProduct) {
      existingProduct.totalQty += orderedQty;
    } else {
      productAgg.set(product.id, {
        productName: product.name,
        unit: product.unit,
        minStock: Number(product.minStock),
        currentStock: Number(product.currentStock),
        totalQty: orderedQty,
      });
    }

    // 2. If the product is made from a recipe, also deduct the ingredients.
    const defaultRecipeProduct = product.recipeProducts[0];
    if (!defaultRecipeProduct) continue;

    const recipe = defaultRecipeProduct.recipe;
    const yieldQty = Number(recipe.yieldQuantity);
    if (yieldQty <= 0) {
      console.warn(
        `[stock-deduction] orderId=${orderId} recipeId=${recipe.id}: yieldQuantity=${yieldQty} is zero or negative, skipping ingredient deduction`
      );
      continue;
    }

    const scaleFactor = orderedQty / yieldQty;
    for (const ing of recipe.ingredients) {
      // Ingredient quantity is scaled in the recipe's own unit, but stock is
      // tracked (and must be deducted/recorded) in the material's stock unit —
      // convert or a "500 g" ingredient silently deducts 500 units of "kg" stock.
      const neededInIngredientUnit = Number(ing.quantity) * scaleFactor;
      const needed = convertUnit(neededInIngredientUnit, ing.unit, ing.material.unit);
      const existingMaterial = materialAgg.get(ing.materialId);
      if (existingMaterial) {
        existingMaterial.totalNeeded += needed;
      } else {
        materialAgg.set(ing.materialId, {
          materialName: ing.material.name,
          materialUnit: ing.material.unit,
          minStock: Number(ing.material.minStock),
          currentStock: Number(ing.material.currentStock),
          totalNeeded: needed,
          unit: ing.material.unit,
        });
      }
    }
  }

  // Selected modifiers/options can optionally carry their own material stock
  // impact (e.g. "Extra Sugar" == +5g), independent of whether the line's
  // product has a recipe at all. Aggregate these into the same materialAgg
  // map so they sum alongside recipe-driven consumption into one deduction
  // per material, one StockMovement, one transaction. materialQty is stored
  // in the linked Material's own unit (enforced when the option is created),
  // so no unit conversion is needed here.
  type SelectedOption = { materialId?: string; materialQty?: number };
  const optionMaterialNeed = new Map<string, number>();
  for (const item of activeItems) {
    const orderedQty = Number(item.quantity);
    const selected = (item.selectedOptions as SelectedOption[] | null) ?? [];
    for (const opt of selected) {
      if (!opt.materialId || !opt.materialQty) continue;
      const needed = opt.materialQty * orderedQty;
      optionMaterialNeed.set(opt.materialId, (optionMaterialNeed.get(opt.materialId) ?? 0) + needed);
    }
  }

  if (optionMaterialNeed.size > 0) {
    const missingMaterialIds = Array.from(optionMaterialNeed.keys()).filter(
      (id) => !materialAgg.has(id)
    );
    const fetchedMaterials = missingMaterialIds.length
      ? await prisma.material.findMany({ where: { id: { in: missingMaterialIds } } })
      : [];
    const fetchedMaterialMap = new Map(fetchedMaterials.map((m) => [m.id, m]));

    for (const [materialId, needed] of optionMaterialNeed.entries()) {
      const existingMaterial = materialAgg.get(materialId);
      if (existingMaterial) {
        existingMaterial.totalNeeded += needed;
        continue;
      }
      const material = fetchedMaterialMap.get(materialId);
      if (!material) {
        console.warn(
          `[stock-deduction] orderId=${orderId}: option material=${materialId} not found, skipping`
        );
        continue;
      }
      materialAgg.set(materialId, {
        materialName: material.name,
        materialUnit: material.unit,
        minStock: Number(material.minStock),
        currentStock: Number(material.currentStock),
        totalNeeded: needed,
        unit: material.unit,
      });
    }
  }

  // Collapse each aggregate to a single deduction with one final newStock.
  const productDeductions: ProductDeduction[] = Array.from(productAgg.entries()).map(
    ([productId, p]) => ({
      productId,
      productName: p.productName,
      unit: p.unit,
      minStock: p.minStock,
      orderedQty: p.totalQty,
      newStock: Math.max(0, p.currentStock - p.totalQty),
    })
  );

  const materialDeductions: MaterialDeduction[] = Array.from(materialAgg.entries()).map(
    ([materialId, m]) => ({
      materialId,
      materialName: m.materialName,
      materialUnit: m.materialUnit,
      minStock: m.minStock,
      needed: m.totalNeeded,
      newStock: Math.max(0, m.currentStock - m.totalNeeded),
      unit: m.unit,
    })
  );

  // An order made up entirely of CUSTOM-productLine items (no stock/recipe
  // deduction) still has cost snapshots to write below, so only bail out
  // here when there's truly nothing to do in the transaction at all.
  if (
    productDeductions.length === 0 &&
    materialDeductions.length === 0 &&
    itemCostSnapshots.size === 0
  ) {
    return { deducted: 0, skipped };
  }

  // Single serializable transaction — prevents concurrent reads of stale stock.
  await prisma.$transaction(
    async (tx) => {
      for (const p of productDeductions) {
        await tx.product.update({
          where: { id: p.productId },
          data: { currentStock: toDecimal(p.newStock) },
        });

        await tx.stockMovement.create({
          data: {
            productId: p.productId,
            orderId,
            type: MovementType.SALE,
            quantity: toDecimal(-p.orderedQty),
            unit: p.unit,
            balanceAfter: toDecimal(p.newStock),
            notes: `Auto-deducted for order ${order.orderNumber}`,
          },
        });
      }

      for (const d of materialDeductions) {
        await tx.material.update({
          where: { id: d.materialId },
          data: { currentStock: toDecimal(d.newStock) },
        });

        await tx.stockMovement.create({
          data: {
            materialId: d.materialId,
            orderId,
            type: MovementType.SALE,
            quantity: toDecimal(-d.needed),
            unit: d.unit,
            balanceAfter: toDecimal(d.newStock),
            notes: `Auto-deducted for order ${order.orderNumber}`,
          },
        });
      }

      for (const [orderItemId, unitCost] of itemCostSnapshots) {
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: { unitCostSnapshot: toDecimal(unitCost) },
        });
      }
    },
    { isolationLevel: "Serializable" }
  );

  publishStockChanged(storeId, {
    productIds: productDeductions.map((p) => p.productId),
    materialIds: materialDeductions.map((d) => d.materialId),
  });

  // Fire alerts outside the transaction — non-critical, OK to be eventually
  // consistent. Shared with production/waste via stock-alerts.helpers so every
  // stock writer raises the same alert; the numbers are passed in directly
  // here since this flow already computed them.
  for (const p of productDeductions) {
    await fireLowStockAlert({
      userId,
      storeId,
      entityId: p.productId,
      entityType: "product",
      name: p.productName,
      newStock: p.newStock,
      minStock: p.minStock,
      unit: p.unit,
    });
  }

  for (const d of materialDeductions) {
    await fireLowStockAlert({
      userId,
      storeId,
      entityId: d.materialId,
      entityType: "material",
      name: d.materialName,
      newStock: d.newStock,
      minStock: d.minStock,
      unit: d.materialUnit,
    });
  }

  return { deducted: productDeductions.length + materialDeductions.length, skipped };
}

/**
 * Reverse stock deducted for an order when it's cancelled after having already
 * reached DELIVERED (i.e. deductStockForOrder already ran for it).
 *
 * Reuses the order's own SALE StockMovement rows as the source of truth for
 * what to restore, rather than recomputing from the order/recipe — robust
 * against the product or recipe having changed since the original sale.
 *
 * Idempotent: if a RETURN StockMovement already exists for this order, the
 * call is a no-op, so retries (or double-clicking cancel) can't double-restock.
 */
export async function reverseStockForOrder(
  orderId: string,
  storeId: string
): Promise<{ reversed: number }> {
  const existingReturn = await prisma.stockMovement.findFirst({
    where: { orderId, type: MovementType.RETURN },
    select: { id: true },
  });
  if (existingReturn) {
    return { reversed: 0 };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, orderNumber: true },
  });
  if (!order || order.storeId !== storeId) return { reversed: 0 };

  const saleMovements = await prisma.stockMovement.findMany({
    where: { orderId, type: MovementType.SALE },
    select: { productId: true, materialId: true, quantity: true, unit: true },
  });
  if (saleMovements.length === 0) return { reversed: 0 };

  await prisma.$transaction(
    async (tx) => {
      for (const movement of saleMovements) {
        const restoreQty = Math.abs(Number(movement.quantity));

        if (movement.productId) {
          const product = await tx.product.findUnique({
            where: { id: movement.productId },
            select: { currentStock: true },
          });
          if (!product) continue;
          const newStock = Number(product.currentStock) + restoreQty;

          await tx.product.update({
            where: { id: movement.productId },
            data: { currentStock: toDecimal(newStock) },
          });
          await tx.stockMovement.create({
            data: {
              productId: movement.productId,
              orderId,
              type: MovementType.RETURN,
              quantity: toDecimal(restoreQty),
              unit: movement.unit,
              balanceAfter: toDecimal(newStock),
              notes: `Restored — order ${order.orderNumber} cancelled`,
            },
          });
        } else if (movement.materialId) {
          const material = await tx.material.findUnique({
            where: { id: movement.materialId },
            select: { currentStock: true },
          });
          if (!material) continue;
          const newStock = Number(material.currentStock) + restoreQty;

          await tx.material.update({
            where: { id: movement.materialId },
            data: { currentStock: toDecimal(newStock) },
          });
          await tx.stockMovement.create({
            data: {
              materialId: movement.materialId,
              orderId,
              type: MovementType.RETURN,
              quantity: toDecimal(restoreQty),
              unit: movement.unit,
              balanceAfter: toDecimal(newStock),
              notes: `Restored — order ${order.orderNumber} cancelled`,
            },
          });
        }
      }
    },
    { isolationLevel: "Serializable" }
  );

  publishStockChanged(storeId, {
    productIds: saleMovements.map((m) => m.productId).filter((id): id is string => Boolean(id)),
    materialIds: saleMovements.map((m) => m.materialId).filter((id): id is string => Boolean(id)),
  });

  return { reversed: saleMovements.length };
}
