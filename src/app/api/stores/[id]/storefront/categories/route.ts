import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createMenuCategorySchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/stores/[id]/storefront/categories
 * 
 * Create a new menu category.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);
    
    const body = await request.json();
    const input = createMenuCategorySchema.parse(body);

    const category = await storefrontService.createMenuCategory(storefront.id, input);
    return NextResponse.json(createSuccessResponse(category), { status: 201 });
  },
  {
    requireStoreAuth: true,
  }
);
