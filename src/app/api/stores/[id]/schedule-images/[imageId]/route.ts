import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { getStorageAdapter } from "@/lib/storage";
import { isOwnUpload } from "@/lib/utils/own-upload";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/stores/[id]/schedule-images/[imageId] — take an image off every
 * staff member's My Schedule. Manager/owner only.
 *
 * A real delete, unlike schedule blocks: nothing else references an image, so
 * there is no history that needs it to keep resolving.
 */
export const DELETE = withApiHandler(
  async (_request, { storeId, userId, params }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { imageId } = params as { imageId: string };
    const existing = await prisma.scheduleImage.findUnique({ where: { id: imageId } });
    // Same 404 for "no such image" and "another store's image": the id of a row in
    // someone else's store must not be confirmable from here.
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Schedule image not found"),
        { status: 404 }
      );
    }

    await prisma.scheduleImage.delete({ where: { id: imageId } });

    // Best-effort, after the row is gone — see the POST route. Only a file this
    // account uploaded: the delete runs with the app-wide Blob token.
    if (isOwnUpload(existing.imageUrl, userId)) {
      try {
        await getStorageAdapter().delete(existing.imageUrl);
      } catch {
        // ignore
      }
    }

    return NextResponse.json(createSuccessResponse({ success: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-images", requireStoreAuth: true }
);
