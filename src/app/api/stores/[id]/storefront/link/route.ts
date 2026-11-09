import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/storefront/link
 *
 * Returns { slug, isPublished } for the store's Phone Orders page, or
 * { slug: null, isPublished: false } when it has none. Read-only on purpose:
 * GET /storefront auto-creates a draft storefront, which a till's menu must
 * not do just by being opened. Used by POS Mode's "Phone Orders" link.
 */
export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const storefront = await prisma.storefront.findUnique({
      where: { storeId: storeId! },
      select: { slug: true, isPublished: true },
    });
    return NextResponse.json(
      createSuccessResponse({
        slug: storefront?.slug ?? null,
        isPublished: storefront?.isPublished ?? false,
      })
    );
  },
  { requireStoreAuth: true }
);
