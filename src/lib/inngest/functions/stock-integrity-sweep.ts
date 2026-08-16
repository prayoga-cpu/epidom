import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { StockMode, AlertType, AlertSeverity } from "@prisma/client";
import { deductStockForOrder } from "@/lib/services/stock-deduction.service";

/**
 * The date the two-tier stock release went out. The catch-up sweep below will
 * not look at anything delivered before this — see the bounds discussion there.
 */
const TWO_TIER_RELEASE = new Date("2026-08-14T00:00:00Z");

/**
 * Nightly report of negative stock balances.
 *
 * A negative balance is the honest record of selling more than the books said
 * existed. It is NEVER auto-corrected: only a human can reconcile it against
 * what is physically on the shelf, and a sweep that "fixed" it would destroy
 * the evidence and reintroduce exactly the silent drift this release removed.
 *
 * One alert per store, listing the offenders, so a shop with twenty negative
 * materials in its first week gets one notification rather than twenty.
 */
export const negativeStockSweep = inngest.createFunction(
  { id: "negative-stock-sweep", retries: 3, triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    const offenders = await step.run("find-negative-balances", async () => {
      const [products, materials] = await Promise.all([
        prisma.product.findMany({
          where: { currentStock: { lt: 0 }, stockMode: StockMode.BATCH_PRODUCED },
          select: { id: true, name: true, storeId: true, currentStock: true, unit: true },
        }),
        prisma.material.findMany({
          where: { currentStock: { lt: 0 } },
          select: { id: true, name: true, storeId: true, currentStock: true, unit: true },
        }),
      ]);
      return [
        ...products.map((p) => ({ ...p, currentStock: Number(p.currentStock), kind: "product" })),
        ...materials.map((m) => ({ ...m, currentStock: Number(m.currentStock), kind: "material" })),
      ];
    });

    if (offenders.length === 0) return { stores: 0, entities: 0 };

    const byStore = new Map<string, typeof offenders>();
    for (const o of offenders) {
      byStore.set(o.storeId, [...(byStore.get(o.storeId) ?? []), o]);
    }

    for (const [storeId, items] of byStore) {
      await step.run(`alert-${storeId}`, async () => {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { business: { select: { userId: true } } },
        });
        if (!store) return;

        const summary = items
          .slice(0, 10)
          .map((i) => `${i.name} (${i.currentStock} ${i.unit})`)
          .join(", ");
        const more = items.length > 10 ? ` and ${items.length - 10} more` : "";

        // Alert is scoped by userId + entityType/entityId — it has no storeId
        // column. One row per store, pointing at the store itself, so a shop
        // with twenty negative materials gets one notification, not twenty.
        await prisma.alert.create({
          data: {
            userId: store.business.userId,
            type: AlertType.CRITICAL_STOCK,
            severity: AlertSeverity.CRITICAL,
            entityType: "store",
            entityId: storeId,
            title: "Sold more than you had",
            message:
              `${items.length} item(s) are showing below zero: ${summary}${more}. ` +
              `Count what's really there and correct it.`,
          },
        });
      });
    }

    return { stores: byStore.size, entities: offenders.length };
  }
);

/**
 * Nightly catch-up for orders whose stock deduction was SWALLOWED.
 *
 * Both deduction call sites catch and log the exception, then return 200 after
 * the receipt has already printed — so a transient database failure silently
 * leaves an order with no stock movement and no cost snapshot, i.e. booked at
 * 100% margin. `deductStockForOrder` is idempotent, so re-running it is safe.
 *
 * THREE BOUNDS, all mandatory:
 *  1. `stockDeductedAt: null` — the explicit marker that deduction never
 *     committed. Without it, the candidate set would be "DELIVERED orders with
 *     no SALE movement", which legitimately includes every aggregator order and
 *     every all-UNTRACKED order.
 *  2. `deliveredDate >= TWO_TIER_RELEASE` — without a date floor the first run
 *     would sweep the entire order history and re-deduct tens of thousands of
 *     orders against today's balances in one pass.
 *  3. A cap per run, so a genuine systemic failure surfaces as a persistent
 *     backlog rather than one enormous unreviewable batch.
 */
export const catchUpStockDeduction = inngest.createFunction(
  { id: "catch-up-stock-deduction", retries: 3, triggers: [{ cron: "30 2 * * *" }] },
  async ({ step }) => {
    const candidates = await step.run("find-undeducted-orders", async () => {
      const orders = await prisma.order.findMany({
        where: {
          status: "DELIVERED",
          stockDeductedAt: null,
          deliveredDate: { gte: TWO_TIER_RELEASE },
          // At least one line that could actually resolve to a product.
          items: { some: { OR: [{ productId: { not: null } }, { menuItemId: { not: null } }] } },
        },
        select: { id: true, storeId: true },
        orderBy: { deliveredDate: "asc" },
        take: 500,
      });
      return orders;
    });

    let recovered = 0;
    for (const order of candidates) {
      const result = await step.run(`deduct-${order.id}`, async () => {
        try {
          return await deductStockForOrder(order.id, order.storeId);
        } catch (err) {
          console.error("[CATCH_UP_DEDUCTION]", order.id, err);
          return null;
        }
      });
      if (result && !result.alreadyDeducted && result.deducted > 0) recovered++;
    }

    return { examined: candidates.length, recovered };
  }
);
