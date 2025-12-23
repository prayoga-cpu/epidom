import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/stock-movements
 * Get stock movements (history) for materials/products in a store
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const materialId = searchParams.get("materialId");
    const productId = searchParams.get("productId");
    const itemType = searchParams.get("itemType"); // 'material' or 'product'
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const type = searchParams.get("type"); // movement type filter

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by item
    if (itemType === "material" && materialId) {
      where.materialId = materialId;
      // Verify material belongs to this store
      const material = await prisma.material.findFirst({
        where: { id: materialId, storeId },
      });
      if (!material) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, "Material not found"),
          { status: 404 }
        );
      }
    } else if (itemType === "product" && productId) {
      where.productId = productId;
      // Verify product belongs to this store
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId },
      });
      if (!product) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Product not found"), {
          status: 404,
        });
      }
    }

    // Filter by movement type
    if (type) {
      where.type = type;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {} as Record<string, Date>;
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    // Fetch stock movements
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        material: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        product: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        productionBatch: {
          select: { id: true, batchNumber: true },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 movements
    });

    return NextResponse.json(createSuccessResponse({ movements, total: movements.length }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/stock-movements", requireStoreAuth: true }
);
