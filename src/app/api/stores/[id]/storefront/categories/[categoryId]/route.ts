import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { updateMenuCategorySchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

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
    return NextResponse.json(createSuccessResponse(category));
  },
  {
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]/storefront/categories/[categoryId]
 * 
 * Delete a menu category.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { categoryId } = params;
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);
    
    await storefrontService.deleteMenuCategory(categoryId, storefront.id);
    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  {
    requireStoreAuth: true,
  }
);
