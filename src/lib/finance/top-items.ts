import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";

/**
 * Top-selling items for a window, grouped by the line's name (what the
 * receipt printed, so a renamed dish starts a new row). Shared by
 * GET /api/stores/[id]/finance/top-items and the Claude connector's
 * get_top_items, so both rank the same lines the same way.
 */

export interface TopItemsQuery {
  window: { from: Date; to: Date };
  /** Narrows the order (shift/staff, channel, payment method). */
  orderFilters?: Prisma.OrderWhereInput;
  /**
   * Narrows the line (category, department). Combined with AND, never spread:
   * two filters can each produce an `OR` (the "none"/"unassigned" sentinels).
   */
  itemFilters?: Prisma.OrderItemWhereInput[];
  limit: number;
  /** Rank by revenue (default, the report's order) or by quantity sold. */
  sortBy?: "revenue" | "quantity";
  /** Also sum every matching line, not just the top `limit`. */
  includeTotals?: boolean;
}

export interface TopItem {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopItemsTotals {
  itemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function loadTopItems(
  storeId: string,
  query: TopItemsQuery
): Promise<{ items: TopItem[]; totals?: TopItemsTotals }> {
  const where: Prisma.OrderItemWhereInput = {
    order: {
      storeId,
      status: { notIn: NON_REVENUE_STATUSES },
      orderDate: { gte: query.window.from, lte: query.window.to },
      ...query.orderFilters,
    },
    AND: query.itemFilters ?? [],
  };

  const rows = await prisma.orderItem.groupBy({
    by: ["name"],
    where,
    _sum: { total: true, quantity: true },
    _count: { id: true },
    orderBy:
      query.sortBy === "quantity" ? { _sum: { quantity: "desc" } } : { _sum: { total: "desc" } },
    take: query.limit,
  });

  const items = rows.map((item) => ({
    name: item.name,
    orderCount: item._count.id,
    totalQuantity: Number(item._sum.quantity ?? 0),
    totalRevenue: round2(Number(item._sum.total ?? 0)),
  }));

  if (!query.includeTotals) return { items };

  const [sums, names] = await Promise.all([
    prisma.orderItem.aggregate({ where, _sum: { total: true, quantity: true } }),
    prisma.orderItem.groupBy({ by: ["name"], where }),
  ]);
  return {
    items,
    totals: {
      itemCount: names.length,
      totalQuantity: round2(Number(sums._sum.quantity ?? 0)),
      totalRevenue: round2(Number(sums._sum.total ?? 0)),
    },
  };
}
