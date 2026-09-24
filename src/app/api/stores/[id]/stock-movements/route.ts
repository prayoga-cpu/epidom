import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { stockMovementsQuerySchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/stock-movements
 * Get stock movements (history) for materials/products in a store.
 *
 * Pages with `cursor` (the last row's id): the response's `nextCursor` is null
 * on the last page.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const query = stockMovementsQuerySchema.parse(Object.fromEntries(searchParams));

    // Every query stays inside this store, whatever else it asks for. An item
    // id sent without its matching `itemType` used to skip this scoping and
    // read every store's movements.
    const conditions: Prisma.StockMovementWhereInput[] = [
      { OR: [{ material: { storeId } }, { product: { storeId } }] },
    ];

    if (query.materialId) {
      const material = await prisma.material.findFirst({
        where: { id: query.materialId, storeId },
        select: { id: true },
      });
      if (!material)
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, "Material not found"),
          { status: 404 }
        );
      conditions.push({ materialId: query.materialId });
    }
    if (query.productId) {
      const product = await prisma.product.findFirst({
        where: { id: query.productId, storeId },
        select: { id: true },
      });
      if (!product)
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Product not found"), {
          status: 404,
        });
      conditions.push({ productId: query.productId });
    }

    if (query.type) conditions.push({ type: query.type });

    if (query.dateFrom || query.dateTo) {
      conditions.push({
        createdAt: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        },
      });
    }

    if (query.q) {
      conditions.push({
        OR: [
          { material: { name: { contains: query.q, mode: "insensitive" } } },
          { product: { name: { contains: query.q, mode: "insensitive" } } },
        ],
      });
    }

    // One row past the page says whether another page exists. `id` breaks
    // createdAt ties so the cursor never skips or repeats a row.
    const rows = await prisma.stockMovement.findMany({
      where: { AND: conditions },
      include: {
        material: { select: { id: true, name: true, sku: true, unit: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
        productionBatch: { select: { id: true, batchNumber: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > query.take;
    const movements = hasMore ? rows.slice(0, query.take) : rows;

    return NextResponse.json(
      createSuccessResponse({
        movements,
        total: movements.length,
        nextCursor: hasMore ? movements[movements.length - 1].id : null,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/stock-movements", requireStoreAuth: true }
);
