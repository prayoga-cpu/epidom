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
 *   4. Subtract from material.currentStock in a transaction.
 *   5. Create a StockMovement record per material.
 *   6. Fire a LOW_STOCK / CRITICAL_STOCK Alert if stock falls below threshold.
 *
 * Items without a linked product or recipe are skipped silently.
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

  let deducted = 0;
  let skipped = 0;

  for (const item of order.items) {
    const product = item.product ?? item.menuItem?.product;
    if (!product) { skipped++; continue; }

    const defaultRecipeProduct = product.recipeProducts[0];
    if (!defaultRecipeProduct) { skipped++; continue; }

    const recipe = defaultRecipeProduct.recipe;
    const orderedQty = Number(item.quantity);
    const yieldQty = Number(recipe.yieldQuantity);
    const scaleFactor = yieldQty > 0 ? orderedQty / yieldQty : 0;

    if (scaleFactor === 0) { skipped++; continue; }

    for (const ing of recipe.ingredients) {
      const needed = Number(ing.quantity) * scaleFactor;
      const current = Number(ing.material.currentStock);
      const newStock = Math.max(0, current - needed);

      await prisma.$transaction(async (tx) => {
        await tx.material.update({
          where: { id: ing.materialId },
          data: { currentStock: toDecimal(newStock) },
        });

        await tx.stockMovement.create({
          data: {
            materialId: ing.materialId,
            orderId,
            type: MovementType.SALE,
            quantity: toDecimal(-needed),
            unit: ing.unit,
            balanceAfter: toDecimal(newStock),
            notes: `Auto-deducted for order ${order.orderNumber}`,
          },
        });
      });

      // Fire persistent alert if material is now below threshold
      if (newStock <= Number(ing.material.minStock)) {
        const isCritical = newStock <= Number(ing.material.minStock) * 0.25;
        const userId = order.store.business.userId;

        // Upsert: one active alert per material (avoid spam on repeated orders)
        const existing = await prisma.alert.findFirst({
          where: {
            userId,
            entityId: ing.materialId,
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
                ? `Stok kritis: ${ing.material.name}`
                : `Stok rendah: ${ing.material.name}`,
              message: `Sisa stok ${ing.material.name}: ${newStock.toFixed(2)} ${ing.material.unit} (min: ${ing.material.minStock} ${ing.material.unit})`,
              entityType: "material",
              entityId: ing.materialId,
            },
          });
        }
      }

      deducted++;
    }
  }

  return { deducted, skipped };
}
