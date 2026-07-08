import { NextResponse } from "next/server";
import { storefrontService, subscriptionService } from "@/lib/services";
import { updateStorefrontSchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/storefront
 *
 * Get the storefront details for the specified store.
 * Creates a draft storefront automatically if it doesn't exist.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);
    return NextResponse.json(createSuccessResponse(storefront));
  },
  {
    requireStoreAuth: true,
  }
);

/**
 * PATCH /api/stores/[id]/storefront
 *
 * Update the storefront settings.
 */
export const PATCH = withApiHandler(
  async (request, { storeId, userId }) => {
    const body = await request.json();
    const input = updateStorefrontSchema.parse(body);

    // Online orders + table reservations are POS features. Coerce them off for
    // users below POS so a stale or hand-crafted request can't enable them.
    if (input.acceptsOrders || input.acceptsReservations) {
      const hasPos = await subscriptionService.hasPosAccess(userId);
      if (!hasPos) {
        input.acceptsOrders = false;
        input.acceptsReservations = false;
      }
    }

    try {
      const updatedStorefront = await storefrontService.updateStorefront(storeId!, input);
      return NextResponse.json(createSuccessResponse(updatedStorefront));
    } catch (error: any) {
      if (error.message.includes("URL slug is already taken")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, error.message), {
          status: 409,
        });
      }
      throw error;
    }
  },
  {
    requireStoreAuth: true,
  }
);
