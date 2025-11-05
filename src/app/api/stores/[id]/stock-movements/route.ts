import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/stores/[id]/stock-movements
 * Get stock movements (history) for materials/products in a store
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: storeId } = await params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const materialId = searchParams.get("materialId");
    const productId = searchParams.get("productId");
    const itemType = searchParams.get("itemType"); // 'material' or 'product'
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const type = searchParams.get("type"); // movement type filter

    // Verify user has access to this store
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        business: {
          userId: session.user.id,
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Build where clause
    const where: any = {};

    // Filter by item
    if (itemType === "material" && materialId) {
      where.materialId = materialId;
      // Verify material belongs to this store
      const material = await prisma.material.findFirst({
        where: { id: materialId, storeId },
      });
      if (!material) {
        return NextResponse.json({ error: "Material not found" }, { status: 404 });
      }
    } else if (itemType === "product" && productId) {
      where.productId = productId;
      // Verify product belongs to this store
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }

    // Filter by movement type
    if (type) {
      where.type = type;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Fetch stock movements
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        material: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        productionBatch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to recent 100 movements
    });

    return NextResponse.json({
      movements,
      total: movements.length,
    });
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
