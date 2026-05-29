import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services";
import { createMenuItemSchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/storefront/items?productId=xxx
 *
 * Returns the MenuItem(s) linked to a given productId within this store's storefront.
 * Used by the product edit flow to detect drift and offer sync.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const storefront = await storefrontService.getStorefrontByStoreId(storeId!);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    const where: Record<string, unknown> = { storefrontId: storefront.id };
    if (productId) where.productId = productId;

    const items = await prisma.menuItem.findMany({
      where,
      select: { id: true, name: true, price: true, productId: true, isAvailable: true },
    });
    return NextResponse.json(createSuccessResponse(items));
  },
  { requireStoreAuth: true }
);

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
