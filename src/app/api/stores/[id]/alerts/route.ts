import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/alerts
 * Get low stock materials for a store
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId } = await params;

    // Get all active materials for the store
    const allMaterials = await prisma.material.findMany({
      where: {
        storeId,
        isActive: true,
      },
      include: {
        materialSuppliers: {
          include: {
            supplier: true,
          },
          where: {
            supplier: {
              isActive: true,
            },
          },
        },
      },
    });

    // Filter materials where currentStock <= minStock
    const lowStockMaterials = allMaterials
      .filter((material) => {
        const currentStock = Number(material.currentStock);
        const minStock = Number(material.minStock);
        return currentStock <= minStock;
      })
      .sort((a, b) => {
        // Sort by stock percentage (most critical first)
        const aPercent = Number(a.minStock) > 0 ? Number(a.currentStock) / Number(a.minStock) : 0;
        const bPercent = Number(b.minStock) > 0 ? Number(b.currentStock) / Number(b.minStock) : 0;
        if (aPercent !== bPercent) return aPercent - bPercent;
        return a.name.localeCompare(b.name);
      });

    // Format alerts
    const alerts = lowStockMaterials.map((material) => {
      const currentStockNum = Number(material.currentStock);
      const minStockNum = Number(material.minStock);
      const stockPercentage = minStockNum > 0 ? (currentStockNum / minStockNum) * 100 : 0;

      let severity: "critical" | "warning" = "warning";
      if (stockPercentage <= 25) {
        severity = "critical";
      }

      return {
        id: material.id,
        type: "LOW_STOCK" as const,
        severity,
        materialId: material.id,
        materialName: material.name,
        materialSku: material.sku,
        currentStock: material.currentStock,
        minStock: material.minStock,
        unit: material.unit,
        stockPercentage,
        suppliers: material.materialSuppliers.map((ms) => ({
          id: ms.supplier.id,
          name: ms.supplier.name,
          price: ms.price,
          isPreferred: ms.isPreferred,
        })),
        createdAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(createSuccessResponse({ alerts }));
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
