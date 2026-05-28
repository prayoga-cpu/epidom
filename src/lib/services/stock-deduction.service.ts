import { prisma } from "@/lib/prisma";
import { MovementType, AlertType, AlertSeverity } from "@prisma/client";
import { toDecimal } from "@/lib/utils/types.server";

/**
 * Deduct ingredient stock when an order is marked DELIVERED.
 *
 * For each order item:
 *   1. Resolve a Product (via direct productId or via menuItem.productId).
 *   2. Find the default Recipe linked to that product.
 *   3. Scale recipe ingredients by (orderedQty / recipe.yieldQuantity).
 *   4. Subtract from material.currentStock in a single serializable transaction.
 *   5. Create a StockMovement record per material.
 *   6. Fire a LOW_STOCK / CRITICAL_STOCK Alert if stock falls below threshold.
 *
 * Items without a linked product or recipe are skipped with a warning log.
 * The entire deduction for all items runs in one transaction to prevent oversell.
 */
export async function deductStockForOrder(
  orderId: string,
  storeId: string
): Promise<{ deducted: number; skipped: number }> {
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

  // Pre-compute deductions outside the transaction so we can log skips first
  type Deduction = {
    materialId: string;
    materialName: string;
    materialUnit: string;
    minStock: number;
    needed: number;
    newStock: number;
    unit: string;
  };

  const deductions: Deduction[] = [];
  let skipped = 0;

  for (const item of order.items) {
    const product = item.product ?? item.menuItem?.product;
    if (!product) {
      console.warn(`[stock-deduction] orderId=${orderId} itemId=${item.id}: no product found, skipping`);
      skipped++;
      continue;
    }

    const defaultRecipeProduct = product.recipeProducts[0];
    if (!defaultRecipeProduct) {
      console.warn(`[stock-deduction] orderId=${orderId} itemId=${item.id} productId=${product.id}: no default recipe, skipping`);
      skipped++;
      continue;
    }

    const recipe = defaultRecipeProduct.recipe;
    const orderedQty = Number(item.quantity);
    const yieldQty = Number(recipe.yieldQuantity);

    if (yieldQty <= 0) {
      console.warn(`[stock-deduction] orderId=${orderId} recipeId=${recipe.id}: yieldQuantity=${yieldQty} is zero or negative, skipping`);
      skipped++;
      continue;
    }

    const scaleFactor = orderedQty / yieldQty;

    for (const ing of recipe.ingredients) {
      const needed = Number(ing.quantity) * scaleFactor;
      const current = Number(ing.material.currentStock);
      const newStock = Math.max(0, current - needed);

      deductions.push({
        materialId: ing.materialId,
        materialName: ing.material.name,
        materialUnit: ing.material.unit,
        minStock: Number(ing.material.minStock),
        needed,
        newStock,
        unit: ing.unit,
      });
    }
  }

  if (deductions.length === 0) return { deducted: 0, skipped };

  // Single serializable transaction — prevents concurrent reads of stale currentStock
  await prisma.$transaction(
    async (tx) => {
      for (const d of deductions) {
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
    },
    { isolationLevel: "Serializable" }
  );

  // Fire alerts outside transaction — non-critical, OK to be eventually consistent
  for (const d of deductions) {
    if (d.newStock <= d.minStock) {
      const isCritical = d.newStock <= d.minStock * 0.25;

      const existing = await prisma.alert.findFirst({
        where: {
          userId,
          entityId: d.materialId,
          type: { in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK] },
          isRead: false,
        },
      });

      if (!existing) {
        await prisma.alert.create({
          data: {
            userId,
            type: isCritical ? AlertType.CRITICAL_STOCK : AlertType.LOW_STOCK,
            severity: isCritical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
            title: isCritical
              ? `Stok kritis: ${d.materialName}`
              : `Stok rendah: ${d.materialName}`,
            message: `Sisa stok ${d.materialName}: ${d.newStock.toFixed(2)} ${d.materialUnit} (min: ${d.minStock} ${d.materialUnit})`,
            entityType: "material",
            entityId: d.materialId,
          },
        });
      }
    }
  }

  return { deducted: deductions.length, skipped };
}
