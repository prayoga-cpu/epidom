import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/recipes/demand
 *
 * Returns POS order counts (last 30 days, DELIVERED orders) per recipe,
 * so the Data / Recipes page can show demand context alongside each recipe card.
 */
export const GET = withApiHandler(async (_request, { storeId }) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Raw aggregation: recipe → its products → their menu items → delivered order items
  const rows = await prisma.$queryRaw<{ recipe_id: string; order_count: bigint }[]>`
    SELECT rp.recipe_id, COUNT(oi.id) AS order_count
    FROM recipe_products rp
    JOIN products p ON p.id = rp.product_id AND p.store_id = ${storeId}
    JOIN menu_items mi ON mi.product_id = p.id
    JOIN order_items oi ON oi.menu_item_id = mi.id
    JOIN orders o ON o.id = oi.order_id
      AND o.store_id = ${storeId}
      AND o.status = 'DELIVERED'
      AND o.created_at >= ${since}
    GROUP BY rp.recipe_id
  `;

  const demand = rows.map((r) => ({
    recipeId: r.recipe_id,
    orderCount30d: Number(r.order_count),
  }));

  return NextResponse.json(createSuccessResponse(demand));
}, { requireStoreAuth: true });
