import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { pushUnsubscribeSchema } from "@/lib/validation/push.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/stores/[id]/push/unsubscribe
 *
 * Removes this store's copy of a browser's Web Push subscription. Scoped
 * to storeId as well as endpoint so a device can never delete a row
 * belonging to a different store.
 */
export const DELETE = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json().catch(() => null);
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()),
        { status: 400 }
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, storeId },
    });

    return NextResponse.json(createSuccessResponse({ unsubscribed: true }));
  },
  { requireStoreAuth: true, rateLimitEndpoint: "/api/stores/[id]/push/unsubscribe" }
);
