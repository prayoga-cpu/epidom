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
export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Raw aggregation: recipe → its products → their menu items → delivered order items.
    //
    // The tables are snake_case (@@map) but their COLUMNS keep Prisma's field
    // names, so they are camelCase and must be quoted. This was written with
    // snake_case columns (rp.product_id) and answered 503 "column does not
    // exist" on every load of the Recipes tab.
    const rows = await prisma.$queryRaw<{ recipe_id: string; order_count: bigint }[]>`
    SELECT rp."recipeId" AS recipe_id, COUNT(oi.id) AS order_count
    FROM recipe_products rp
    JOIN products p ON p.id = rp."productId" AND p."storeId" = ${storeId}
    JOIN menu_items mi ON mi."productId" = p.id
    JOIN order_items oi ON oi."menuItemId" = mi.id
    JOIN orders o ON o.id = oi."orderId"
      AND o."storeId" = ${storeId}
      AND o.status = 'DELIVERED'
      AND o."createdAt" >= ${since}
    GROUP BY rp."recipeId"
  `;

    const demand = rows.map((r) => ({
      recipeId: r.recipe_id,
      orderCount30d: Number(r.order_count),
    }));

    return NextResponse.json(createSuccessResponse(demand));
  },
  { requireStoreAuth: true }
);
