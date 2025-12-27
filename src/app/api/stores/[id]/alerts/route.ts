/**
 * @file api/stores/[id]/alerts/route.ts
 * @description Store Alerts API Endpoint
 * Handles retrieval of dashboard alerts, primarily low stock warnings.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/alerts
 *
 * Retrieves active alerts for a specific store.
 * Currently focuses on Low Stock alerts based on minStock thresholds.
 *
 * Logic:
 * 1. Verifies store ownership (via withApiHandler).
 * 2. Fetches all active materials.
 * 3. Filters materials where currentStock <= minStock.
 * 4. Calculates severity (Critical if <= 25% of minStock).
 * 5. Returns sorted list (most critical first).
 *
 * @param {string} storeId - ID of the store (from route params)
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    // Get all active materials for the store
    // Optimization: Consider adding database-level filtering if dataset grows large
    const allMaterials = await prisma.material.findMany({
      where: {
        storeId,
      },
      include: {
        materialSuppliers: {
          include: {
            supplier: true,
          },
        },
      },
    });

    // Filter materials where currentStock <= minStock
    const lowStockMaterials = allMaterials
      .filter((material) => {
        const currentStock = Number(material.currentStock);
        const minStock = Number(material.minStock);
        // Only alert if minStock is set (> 0) and threshold is breached
        return minStock > 0 && currentStock <= minStock;
      })
      .sort((a, b) => {
        // Sort by stock percentage (most critical first)
        // Avoid division by zero by checking minStock > 0
        const aPercent = Number(a.minStock) > 0 ? Number(a.currentStock) / Number(a.minStock) : 1;
        const bPercent = Number(b.minStock) > 0 ? Number(b.currentStock) / Number(b.minStock) : 1;

        if (aPercent !== bPercent) return aPercent - bPercent;
        return a.name.localeCompare(b.name);
      });

    // Format alerts for frontend consumption
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
        createdAt: new Date().toISOString(), // Dynamic timestamp for the alert
      };
    });

    return NextResponse.json(createSuccessResponse({ alerts }));
  },
  {
    // Apply standard rate limiting for dashboard widgets
    rateLimitEndpoint: "/api/stores/[id]/alerts",
    requireStoreAuth: true, // Auto-verify store ownership
  }
);
