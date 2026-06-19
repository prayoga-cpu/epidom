import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/storefront/check-slug?slug=my-store
 *
 * Returns { available: boolean } — checks whether a slug is free.
 * The current store's own slug is always treated as available so the
 * field doesn't show an error while the user is on the same value.
 */
export const GET = withApiHandler(async (request, { storeId }) => {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();

  if (!slug || slug.length < 3) {
    return NextResponse.json(createSuccessResponse({ available: false, reason: "too_short" }));
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(createSuccessResponse({ available: false, reason: "invalid_chars" }));
  }

  const existing = await prisma.storefront.findUnique({
    where: { slug },
    select: { storeId: true },
  });

  // Available if no record exists, or if it belongs to this store (same value)
  const available = !existing || existing.storeId === storeId;

  return NextResponse.json(createSuccessResponse({ available, reason: available ? null : "taken" }));
}, { requireStoreAuth: true });
