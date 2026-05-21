import { NextResponse } from "next/server";
import { storefrontService } from "@/lib/services";
import { createMenuItemSchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * POST /api/stores/[id]/storefront/items
 * 
 * Create a new menu item.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);
    
    const body = await request.json();
    const input = createMenuItemSchema.parse(body);

    const item = await storefrontService.createMenuItem(storefront.id, input);
    return NextResponse.json(createSuccessResponse(item), { status: 201 });
  },
  {
    requireStoreAuth: true,
  }
);
