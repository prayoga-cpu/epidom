import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { UNCATEGORIZED_CATEGORY } from "@/lib/constants/pos";

/**
 * GET /api/stores/[id]/pos/menu
 * Returns menu items grouped by category for the POS cashier screen. Only
 * returns items from the store's active storefront.
 *
 * CUSTOM-productLine items (the optional second product line — see
 * Product.productLine) are folded into the same grouped list as everything
 * else — they're real, normally-categorized products, "just like any
 * product" — but their `department` is overridden to the client-facing
 * sentinel `"CUSTOM"` (their real DB department stays inert Kitchen) so
 * PosDepartmentBar/PosItemGrid can filter by it as a genuine third
 * department alongside Kitchen/Bar. Excluded entirely when the store hasn't
 * enabled the feature.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
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
        createErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "No storefront found for this store. Create a storefront first."
        ),
        { status: 404 }
      );
    }

    const menuItems = await prisma.menuItem.findMany({
      // showOnCashier: true is the default for every existing item — a
      // genuine presence filter, unlike isAvailable's client-side greyed
      // out treatment elsewhere.
      where: { storefrontId: storefront.id, showOnCashier: true },
      orderBy: [{ categoryId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isAvailable: true,
        category: true,
        department: true,
        modifiers: true,
        product: {
          select: {
            productLine: true,
            optionGroups: {
              orderBy: { displayOrder: "asc" },
              include: { options: { orderBy: { displayOrder: "asc" } } },
            },
          },
        },
      },
    });

    // CUSTOM items only appear at all while the store has the feature on —
    // presence in this list is the on/off signal (custom-products-section.tsx
    // never exposes a per-item toggle). isAvailable/department are
    // overridden per-item below regardless of their inert stored values.
    const visibleItems = verification.customProductsEnabled
      ? menuItems
      : menuItems.filter((i) => i.product?.productLine !== "CUSTOM");

    // Group by category
    const categoryMap = new Map<string, typeof visibleItems>();
    for (const item of visibleItems) {
      const cat = item.category?.name ?? UNCATEGORIZED_CATEGORY;
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(item);
    }

    const grouped = Array.from(categoryMap.entries()).map(([name, items]) => ({
      name,
      items: items.map((i) => {
        const isCustom = i.product?.productLine === "CUSTOM";
        return {
          ...i,
          price: Number(i.price),
          ...(isCustom && { department: "CUSTOM" as const, isAvailable: true }),
        };
      }),
    }));

    return NextResponse.json(
      createSuccessResponse({
        categories: grouped,
        total: visibleItems.length,
        customProductsEnabled: verification.customProductsEnabled,
        customProductsLabel: verification.customProductsLabel,
      })
    );
  } catch (error) {
    console.error("[POS_MENU_GET]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
