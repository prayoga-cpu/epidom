import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * GET /api/stores/[id]/pos/menu
 * Returns menu items grouped by category for the POS cashier screen.
 * Only returns items from the store's active storefront.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  try {
    const storefront = await prisma.storefront.findUnique({
      where: { storeId },
      select: { id: true, isPublished: true },
    });

    if (!storefront) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No storefront found for this store. Create a storefront first."),
        { status: 404 }
      );
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { storefrontId: storefront.id },
      orderBy: [{ categoryId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        category: true,
      },
    });

    // Group by category
    const categoryMap = new Map<string, typeof menuItems>();
    for (const item of menuItems) {
      const cat = item.category?.name ?? "Lainnya";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }

    const grouped = Array.from(categoryMap.entries()).map(([name, items]) => ({
      name,
      items: items.map((i) => ({
        ...i,
        price: Number(i.price),
      })),
    }));

    return NextResponse.json(createSuccessResponse({ categories: grouped, total: menuItems.length }));
  } catch (error) {
    console.error("[POS_MENU_GET]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
