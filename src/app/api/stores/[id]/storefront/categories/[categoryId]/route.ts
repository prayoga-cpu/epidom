import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import {
  updateMenuCategorySchema,
  deleteMenuCategorySchema,
} from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { publishStoreEvent } from "@/lib/realtime/publish";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";

/**
 * PATCH /api/stores/[id]/storefront/categories/[categoryId]
 *
 * Update an existing menu category.
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { categoryId } = params;
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);

    const body = await request.json();
    const input = updateMenuCategorySchema.parse(body);

    const category = await storefrontService.updateMenuCategory(categoryId, storefront.id, input);
    publishStoreEvent(storeId!, REALTIME_EVENTS.MENU_CHANGED, {
      action: "updated",
      entityId: categoryId,
    });
    return NextResponse.json(createSuccessResponse(category));
  },
  {
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]/storefront/categories/[categoryId]
 *
 * Delete a menu category. Request body: { mode?: "uncategorize" | "delete" }.
 * "uncategorize" (default) keeps the category's items, moving them to
 * Uncategorized. "delete" removes the items along with the category.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { categoryId } = params;
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);

    const body = await request.json().catch(() => ({}));
    const { mode } = deleteMenuCategorySchema.parse(body);

    await storefrontService.deleteMenuCategory(categoryId, storefront.id, mode);
    publishStoreEvent(storeId!, REALTIME_EVENTS.MENU_CHANGED, {
      action: "deleted",
      entityId: categoryId,
    });
    return NextResponse.json(createSuccessResponse({ success: true, mode }));
  },
  {
    requireStoreAuth: true,
  }
);
