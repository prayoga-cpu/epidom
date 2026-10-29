/**
 * @file api/stores/[id]/alerts/route.ts
 * @description Store Alerts API Endpoint
 * Handles retrieval of dashboard alerts, primarily low stock warnings.
 */

import { NextResponse } from "next/server";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { loadStoreAlerts } from "@/lib/services/store-alerts.service";

/**
 * GET /api/stores/[id]/alerts
 *
 * Retrieves active alerts for a specific store.
 * Currently focuses on Low Stock alerts based on minStock thresholds.
 *
 * Logic (loadStoreAlerts, shared with the Claude connector):
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
    const { lowStock, unpaidOrders } = await loadStoreAlerts(storeId!);
    return NextResponse.json(createSuccessResponse({ alerts: [...lowStock, ...unpaidOrders] }));
  },
  {
    // Apply standard rate limiting for dashboard widgets
    rateLimitEndpoint: "/api/stores/[id]/alerts",
    requireStoreAuth: true, // Auto-verify store ownership
  }
);
