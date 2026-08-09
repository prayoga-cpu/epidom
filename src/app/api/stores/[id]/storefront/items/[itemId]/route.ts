import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { updateMenuItemSchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/**
 * PATCH /api/stores/[id]/storefront/items/[itemId]
 *
 * Update an existing menu item.
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { itemId } = params;
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);

    const body = await request.json();
    const input = updateMenuItemSchema.parse(body);

    const item = await storefrontService.updateMenuItem(itemId, storefront.id, input);
    publishStoreEvent(storeId!, REALTIME_EVENTS.MENU_CHANGED, {
      action: "updated",
      entityId: itemId,
    });
    return NextResponse.json(createSuccessResponse(item));
  },
  {
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]/storefront/items/[itemId]
 *
 * Delete a menu item.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { itemId } = params;
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);

    await storefrontService.deleteMenuItem(itemId, storefront.id);
    publishStoreEvent(storeId!, REALTIME_EVENTS.MENU_CHANGED, {
      action: "deleted",
      entityId: itemId,
    });
    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  {
    requireStoreAuth: true,
  }
);
