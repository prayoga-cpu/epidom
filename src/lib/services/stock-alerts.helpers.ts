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

type AlertLocale = "en" | "fr" | "id" | "th";

interface StockAlertCopy {
  critical: (name: string) => string;
  low: (name: string) => string;
  /** Persisted on the Alert row. */
  message: (name: string, left: string, min: number, unit: string) => string;
  /** Sent to the owner through MagicBell. */
  content: (left: string, min: number, unit: string) => string;
}

// Alerts have no viewer to ask, so they speak the store's own language
// (Business.locale). English when the locale is unknown; `id` is the original
// copy, kept verbatim.
const STOCK_ALERT_COPY: Record<AlertLocale, StockAlertCopy> = {
  id: {
    critical: (name) => `Stok kritis: ${name}`,
    low: (name) => `Stok rendah: ${name}`,
    message: (name, left, min, unit) => `Sisa stok ${name}: ${left} ${unit} (min: ${min} ${unit})`,
    content: (left, min, unit) => `Sisa stok: ${left} ${unit} (min: ${min} ${unit})`,
  },
  en: {
    critical: (name) => `Critical stock: ${name}`,
    low: (name) => `Low stock: ${name}`,
    message: (name, left, min, unit) => `${name} stock left: ${left} ${unit} (min: ${min} ${unit})`,
    content: (left, min, unit) => `Stock left: ${left} ${unit} (min: ${min} ${unit})`,
  },
  fr: {
    critical: (name) => `Stock critique\u00a0: ${name}`,
    low: (name) => `Stock bas\u00a0: ${name}`,
    message: (name, left, min, unit) =>
      `Stock restant de ${name}\u00a0: ${left} ${unit} (min\u00a0: ${min} ${unit})`,
    content: (left, min, unit) =>
      `Stock restant\u00a0: ${left} ${unit} (min\u00a0: ${min} ${unit})`,
  },
  th: {
    critical: (name) => `สต็อกวิกฤต: ${name}`,
    low: (name) => `สต็อกใกล้หมด: ${name}`,
    message: (name, left, min, unit) => `${name} คงเหลือ ${left} ${unit} (ขั้นต่ำ ${min} ${unit})`,
    content: (left, min, unit) => `คงเหลือ ${left} ${unit} (ขั้นต่ำ ${min} ${unit})`,
  },
};

function stockAlertLocale(locale: string | null | undefined): AlertLocale {
  return locale === "fr" || locale === "id" || locale === "th" ? locale : "en";
}

export interface LowStockAlertParams {
  userId: string;
  storeId: string;
  entityId: string;
  entityType: "product" | "material";
  name: string;
  newStock: number;
  minStock: number;
  unit: string;
  /** Business.locale of the store — picks the language of the alert text. */
  locale?: string | null;
}

export async function fireLowStockAlert(params: LowStockAlertParams): Promise<void> {
  if (params.minStock <= 0 || params.newStock > params.minStock) return;

  const isCritical = params.newStock <= params.minStock * 0.25;
  const copy = STOCK_ALERT_COPY[stockAlertLocale(params.locale)];
  const title = isCritical ? copy.critical(params.name) : copy.low(params.name);
  const left = params.newStock.toFixed(2);
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
      title,
      message: copy.message(params.name, left, params.minStock, params.unit),
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
      title,
      content: copy.content(left, params.minStock, params.unit),
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
        select: { business: { select: { userId: true, locale: true } } },
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
    const locale = store?.business.locale;

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
        locale,
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
        locale,
      });
    }
  } catch (err) {
    console.error(`[stock-alerts] low-stock check failed (store=${storeId}):`, err);
  }
}
