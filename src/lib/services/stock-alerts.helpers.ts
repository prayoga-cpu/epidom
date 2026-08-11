import { prisma } from "@/lib/prisma";
import { AlertType, AlertSeverity } from "@prisma/client";
import { sendMerchantAlert } from "@/lib/magicbell/client";

/**
 * Shared LOW_STOCK / CRITICAL_STOCK alerting for any flow that drives a
 * Material or Product below its minimum.
 *
 * Extracted verbatim from the closure that used to live inside
 * `deductStockForOrder` — a sale was the only thing that could ever raise a
 * low-stock alert, so a recipe run or a waste entry could silently empty a
 * material and the merchant would hear about it only on the next sale.
 * Behaviour (thresholds, dedup, row shape, copy) is deliberately unchanged;
 * it just has more callers now.
 *
 * Always call these AFTER the stock write's transaction has committed —
 * alerting is non-critical and eventually consistent, and must never be able
 * to fail (or roll back) the stock write itself.
 */

export interface LowStockAlertParams {
  userId: string;
  storeId: string;
  entityId: string;
  entityType: "product" | "material";
  name: string;
  newStock: number;
  minStock: number;
  unit: string;
}

export async function fireLowStockAlert(params: LowStockAlertParams): Promise<void> {
  if (params.minStock <= 0 || params.newStock > params.minStock) return;

  const isCritical = params.newStock <= params.minStock * 0.25;
  const existing = await prisma.alert.findFirst({
    where: {
      userId: params.userId,
      entityId: params.entityId,
      type: { in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK] },
      isRead: false,
    },
  });
  if (existing) return;

  await prisma.alert.create({
    data: {
      userId: params.userId,
      type: isCritical ? AlertType.CRITICAL_STOCK : AlertType.LOW_STOCK,
      severity: isCritical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      title: isCritical ? `Stok kritis: ${params.name}` : `Stok rendah: ${params.name}`,
      message: `Sisa stok ${params.name}: ${params.newStock.toFixed(2)} ${params.unit} (min: ${params.minStock} ${params.unit})`,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });

  // Only alerts when a NEW alert row was actually created above — the dedup
  // check just above already blocks re-firing on every subsequent order
  // once an unread alert exists for this entity, so reuse it as-is
  // rather than a second dedup layer.
  const owner = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (owner) {
    sendMerchantAlert({
      recipientEmail: owner.email,
      recipientExternalId: params.userId,
      category: "low-stock",
      title: isCritical ? `Stok kritis: ${params.name}` : `Stok rendah: ${params.name}`,
      content: `Sisa stok: ${params.newStock.toFixed(2)} ${params.unit} (min: ${params.minStock} ${params.unit})`,
      actionUrl: `/store/${params.storeId}/data`,
    });
  }
}

/**
 * Convenience wrapper for callers that already committed a deduction and know
 * only *which* entities moved, not their post-write numbers (production
 * batches, waste entries). Re-reads the committed stock/min/name in one query
 * per kind rather than making every caller thread six fields through its own
 * transaction bookkeeping.
 *
 * Swallows its own failures on purpose: an alert is a courtesy, and the stock
 * write it follows has already committed — throwing here would surface a
 * scary error for an operation that actually succeeded.
 */
export async function fireLowStockAlertsForEntities(
  storeId: string,
  entities: ReadonlyArray<{ entityId: string; entityType: "product" | "material" }>
): Promise<void> {
  if (entities.length === 0) return;

  try {
    const materialIds = entities.filter((e) => e.entityType === "material").map((e) => e.entityId);
    const productIds = entities.filter((e) => e.entityType === "product").map((e) => e.entityId);

    const [store, materials, products] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { business: { select: { userId: true } } },
      }),
      // `storeId` in the where clause is not redundant with the id filter:
      // every read scopes to the tenant, so a stale/mismatched id can never
      // read another store's stock into this store's alert.
      materialIds.length
        ? prisma.material.findMany({
            where: { storeId, id: { in: materialIds } },
            select: { id: true, name: true, currentStock: true, minStock: true, unit: true },
          })
        : Promise.resolve([]),
      productIds.length
        ? prisma.product.findMany({
            where: { storeId, id: { in: productIds } },
            select: { id: true, name: true, currentStock: true, minStock: true, unit: true },
          })
        : Promise.resolve([]),
    ]);

    // Same owner resolution as deductStockForOrder — alerts belong to the
    // business owner, not to whichever staff member triggered the write.
    const userId = store?.business.userId;
    if (!userId) return;

    for (const material of materials) {
      await fireLowStockAlert({
        userId,
        storeId,
        entityId: material.id,
        entityType: "material",
        name: material.name,
        newStock: Number(material.currentStock),
        minStock: Number(material.minStock),
        unit: material.unit,
      });
    }

    for (const product of products) {
      await fireLowStockAlert({
        userId,
        storeId,
        entityId: product.id,
        entityType: "product",
        name: product.name,
        newStock: Number(product.currentStock),
        minStock: Number(product.minStock),
        unit: product.unit,
      });
    }
  } catch (err) {
    console.error(`[stock-alerts] low-stock check failed (store=${storeId}):`, err);
  }
}
