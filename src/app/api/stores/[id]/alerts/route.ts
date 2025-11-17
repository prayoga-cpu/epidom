import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/stores/[id]/alerts
 * Get low stock materials for a store
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeId = (await params).id;

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
          phone: ms.supplier.phone || null,
        })),
        createdAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
