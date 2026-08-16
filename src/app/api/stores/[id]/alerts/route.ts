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
 * 3. Filters materials where currentStock < 0 (oversold) or currentStock <= minStock.
 * 4. Calculates severity (Critical if oversold, or <= 25% of minStock).
 * 5. Returns sorted list (oversold first, then most critical).
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

    // Filter materials that are oversold or below their reorder threshold
    const lowStockMaterials = allMaterials
      .filter((material) => {
        const currentStock = Number(material.currentStock);
        const minStock = Number(material.minStock);
        // A negative balance means the store consumed material it did not
        // have. It must alert regardless of minStock: that column defaults to
        // 0, and MADE_TO_ORDER products only started draining raw materials
        // recently, so most stores have never maintained it — gating on it
        // would hide every oversold material behind a threshold nobody set.
        if (currentStock < 0) return true;
        // Otherwise only alert if minStock is set (> 0) and threshold is breached
        return minStock > 0 && currentStock <= minStock;
      })
      .sort((a, b) => {
        const aStock = Number(a.currentStock);
        const bStock = Number(b.currentStock);
        const aOversold = aStock < 0;
        const bOversold = bStock < 0;

        // Oversold outranks everything — you cannot be more out of stock than
        // owing stock. Deepest hole first.
        if (aOversold !== bOversold) return aOversold ? -1 : 1;
        if (aOversold && bOversold) {
          if (aStock !== bStock) return aStock - bStock;
          return a.name.localeCompare(b.name);
        }

        // Sort by stock percentage (most critical first)
        // Avoid division by zero by checking minStock > 0
        const aPercent = Number(a.minStock) > 0 ? aStock / Number(a.minStock) : 1;
        const bPercent = Number(b.minStock) > 0 ? bStock / Number(b.minStock) : 1;

        if (aPercent !== bPercent) return aPercent - bPercent;
        return a.name.localeCompare(b.name);
      });

    // Format alerts for frontend consumption
    const alerts = lowStockMaterials.map((material) => {
      const currentStockNum = Number(material.currentStock);
      const minStockNum = Number(material.minStock);
      const isNegativeStock = currentStockNum < 0;
      // A negative balance has no meaningful ratio to the reorder threshold —
      // it is below empty, not a fraction of it. Report 0 so the progress bars
      // downstream read "nothing left" instead of a negative width; the real
      // figure travels in `currentStock`, and `isNegativeStock` tells the UI to
      // render the negativeStock copy instead of a percentage.
      const stockPercentage = isNegativeStock
        ? 0
        : minStockNum > 0
          ? (currentStockNum / minStockNum) * 100
          : 0;

      let severity: "critical" | "warning" = "warning";
      if (isNegativeStock || stockPercentage <= 25) {
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
        isNegativeStock,
        // i18n keys rather than text: this is a server route with no locale
        // context. Null when the balance is merely low, so the existing low
        // stock copy keeps rendering.
        titleKey: isNegativeStock ? ("alerts.negativeStock.title" as const) : null,
        bodyKey: isNegativeStock ? ("alerts.negativeStock.body" as const) : null,
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

    // Pay Later orders that are still unpaid — computed live from Order the
    // same way low stock is computed live from Material, rather than a
    // persisted Alert row, so it can never go stale. Not scoped to DELIVERED
    // only: production no longer gates on payment, so a Pay Later tab can sit
    // unpaid all the way from CONFIRMED through READY before ever reaching
    // DELIVERED — this needs to surface regardless of production stage.
    const unpaidOrders = await prisma.order.findMany({
      where: {
        storeId,
        paymentMethod: "PAY_LATER",
        paymentStatus: "PENDING",
        status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED"] },
      },
      orderBy: { deliveredDate: "asc" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        deliveredDate: true,
        createdAt: true,
      },
    });

    const unpaidOrderAlerts = unpaidOrders.map((order) => ({
      id: order.id,
      type: "UNPAID_ORDER" as const,
      severity: "warning" as const,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: order.total,
      deliveredAt: (order.deliveredDate ?? order.createdAt).toISOString(),
      createdAt: order.createdAt.toISOString(),
    }));

    return NextResponse.json(createSuccessResponse({ alerts: [...alerts, ...unpaidOrderAlerts] }));
  },
  {
    // Apply standard rate limiting for dashboard widgets
    rateLimitEndpoint: "/api/stores/[id]/alerts",
    requireStoreAuth: true, // Auto-verify store ownership
  }
);
