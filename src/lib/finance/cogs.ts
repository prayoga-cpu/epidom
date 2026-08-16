import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CogsResult {
  /**
   * Base currency (IDR). Convert with `storefrontService.convertBaseToOwnerSync`
   * before combining with revenue — revenue is already in the owner's currency.
   */
  cogsBase: number;
  /** OrderItem rows in this window with no cost source at all. */
  unknownCostLines: number;
  /** Their revenue, so the UI can say what fraction of the window is uncosted. */
  unknownCostRevenue: number;
}

/**
 * Cost of goods sold for an order-scoped window, in BASE currency.
 *
 * Single source of truth. Three production copies of this formula had drifted
 * apart (the store finance summary, the finance print page and the owner
 * summary), plus a fourth reimplementation inlined in a test that tested nothing
 * about the route and stayed green while production COGS changed.
 *
 * DUAL-SOURCE BY ORDER, deliberately:
 *
 *  - Orders with at least one OrderItem carrying a non-null `unitCostSnapshot`
 *    use the FROZEN per-line snapshots. That is order-scoped (so shift, channel
 *    and payment filters behave exactly as they do for revenue), recognised at
 *    the moment of sale, and immune to a later supplier price edit retroactively
 *    rewriting last month's margin.
 *
 *  - Orders with NO snapshot anywhere fall back to the legacy material-SALE
 *    ledger. `unitCostSnapshot` was added nullable and never backfilled, so a
 *    naive `?? 0` would rewrite EVERY pre-snapshot reporting window to exactly
 *    zero COGS and 100% gross margin — the opposite direction from the
 *    correction this release exists to make. Keying on per-order presence rather
 *    than a date constant is exact at the boundary (an order placed before the
 *    column existed but delivered after it does have a snapshot) and self-heals
 *    as history ages out.
 *
 * The snapshot term is `unitCostSnapshot + optionCostSnapshot`. Modifier
 * materials are the only material SALE rows most stores write, so a
 * snapshot-only model would silently delete them from the P&L.
 *
 * Lines with no cost at all are COUNTED, not zeroed. Aggregator orders write
 * OrderItems with neither menuItemId nor productId, so they can never acquire a
 * snapshot and never produced a material movement; their cost is genuinely
 * unknown and is reported as such rather than rendered as 0.
 *
 * NOT filtered by OrderItem.status: a snapshot only exists for a line that was
 * active at deduction time, so filtering buys nothing — and it would actively
 * break the P&L, because cancelling a line post-delivery does not recompute
 * `Order.total`. Dropping its cost while its revenue stayed would jump a 60%
 * gross margin to 76% on a manager's late correction.
 */
export async function sumCogsBase(orderWhere: Prisma.OrderWhereInput): Promise<CogsResult> {
  // One narrow id projection rather than materialising every OrderItem row in a
  // server component — an annual P&L print is hundreds of thousands of lines.
  const orders = await prisma.order.findMany({ where: orderWhere, select: { id: true } });
  if (orders.length === 0) {
    return { cogsBase: 0, unknownCostLines: 0, unknownCostRevenue: 0 };
  }
  const ids = orders.map((o) => o.id);

  const [snapshot] = await prisma.$queryRaw<
    { cogs: number; unknown_lines: number; unknown_revenue: number }[]
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(
        CASE WHEN oi."unitCostSnapshot" IS NOT NULL
             THEN oi."quantity" * (oi."unitCostSnapshot" + COALESCE(oi."optionCostSnapshot", 0))
             ELSE 0 END), 0)::float8                                AS cogs,
      COUNT(*) FILTER (WHERE oi."unitCostSnapshot" IS NULL)::int     AS unknown_lines,
      COALESCE(SUM(CASE WHEN oi."unitCostSnapshot" IS NULL
                        THEN oi."total" ELSE 0 END), 0)::float8      AS unknown_revenue
      FROM "order_items" oi
     WHERE oi."orderId" = ANY(${ids})
  `);

  // Legacy term: only orders with no snapshot anywhere, so the two sources can
  // never double-count the same order.
  const [legacy] = await prisma.$queryRaw<{ cogs: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM(ABS(sm."quantity") * m."unitCost"), 0)::float8 AS cogs
      FROM "stock_movements" sm
      JOIN "ingredients" m ON m."id" = sm."materialId"
     WHERE sm."orderId" = ANY(${ids})
       AND sm."type" = 'SALE'
       AND NOT EXISTS (
             SELECT 1 FROM "order_items" oi
              WHERE oi."orderId" = sm."orderId"
                AND oi."unitCostSnapshot" IS NOT NULL)
  `);

  return {
    cogsBase: Number(snapshot?.cogs ?? 0) + Number(legacy?.cogs ?? 0),
    unknownCostLines: Number(snapshot?.unknown_lines ?? 0),
    unknownCostRevenue: Number(snapshot?.unknown_revenue ?? 0),
  };
}

/**
 * Batched variant for the owner dashboard, which aggregates many stores at once
 * and must not issue one query per store.
 */
export async function sumCogsBaseByStore(
  orderWhere: Prisma.OrderWhereInput
): Promise<Map<string, CogsResult>> {
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: { id: true, storeId: true },
  });
  const byStore = new Map<string, CogsResult>();
  if (orders.length === 0) return byStore;

  const ids = orders.map((o) => o.id);
  const storeByOrder = new Map(orders.map((o) => [o.id, o.storeId]));

  const snapshotRows = await prisma.$queryRaw<
    { orderId: string; cogs: number; unknown_lines: number; unknown_revenue: number }[]
  >(Prisma.sql`
    SELECT oi."orderId" AS "orderId",
      COALESCE(SUM(
        CASE WHEN oi."unitCostSnapshot" IS NOT NULL
             THEN oi."quantity" * (oi."unitCostSnapshot" + COALESCE(oi."optionCostSnapshot", 0))
             ELSE 0 END), 0)::float8                                AS cogs,
      COUNT(*) FILTER (WHERE oi."unitCostSnapshot" IS NULL)::int     AS unknown_lines,
      COALESCE(SUM(CASE WHEN oi."unitCostSnapshot" IS NULL
                        THEN oi."total" ELSE 0 END), 0)::float8      AS unknown_revenue
      FROM "order_items" oi
     WHERE oi."orderId" = ANY(${ids})
     GROUP BY oi."orderId"
  `);

  const legacyRows = await prisma.$queryRaw<{ orderId: string; cogs: number }[]>(Prisma.sql`
    SELECT sm."orderId" AS "orderId",
           COALESCE(SUM(ABS(sm."quantity") * m."unitCost"), 0)::float8 AS cogs
      FROM "stock_movements" sm
      JOIN "ingredients" m ON m."id" = sm."materialId"
     WHERE sm."orderId" = ANY(${ids})
       AND sm."type" = 'SALE'
       AND NOT EXISTS (
             SELECT 1 FROM "order_items" oi
              WHERE oi."orderId" = sm."orderId"
                AND oi."unitCostSnapshot" IS NOT NULL)
     GROUP BY sm."orderId"
  `);

  const bump = (orderId: string, patch: Partial<CogsResult>) => {
    const storeId = storeByOrder.get(orderId);
    if (!storeId) return;
    const current = byStore.get(storeId) ?? {
      cogsBase: 0,
      unknownCostLines: 0,
      unknownCostRevenue: 0,
    };
    byStore.set(storeId, {
      cogsBase: current.cogsBase + (patch.cogsBase ?? 0),
      unknownCostLines: current.unknownCostLines + (patch.unknownCostLines ?? 0),
      unknownCostRevenue: current.unknownCostRevenue + (patch.unknownCostRevenue ?? 0),
    });
  };

  for (const row of snapshotRows) {
    bump(row.orderId, {
      cogsBase: Number(row.cogs),
      unknownCostLines: Number(row.unknown_lines),
      unknownCostRevenue: Number(row.unknown_revenue),
    });
  }
  for (const row of legacyRows) {
    bump(row.orderId, { cogsBase: Number(row.cogs) });
  }

  return byStore;
}
