/**
 * GET /api/stores/[id]/pos/orders/[orderId]/receipt
 *
 * Returns the same ReceiptData shape buildEscPos() consumes, for a past
 * order — used by the client to reprint an order's receipt on the paired
 * Bluetooth printer from order history or the printer menu's "reprint last
 * order" action. Store-scoped (unlike the public /r/[orderId] page).
 */
import { NextResponse } from "next/server";
import { buildReceiptData } from "@/lib/receipts/build-receipt-data";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const built = await buildReceiptData(orderId);
    if (!built || built.storeId !== storeId) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    return NextResponse.json(createSuccessResponse(built.receipt));
  },
  { rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/receipt", requireStoreAuth: true }
);
