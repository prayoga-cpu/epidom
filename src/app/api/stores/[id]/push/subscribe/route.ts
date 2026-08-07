import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { pushSubscribeSchema } from "@/lib/validation/push.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/push/subscribe
 *
 * Registers (or re-points) a browser's Web Push subscription for this
 * store. Upserted by `endpoint` (globally unique per browser/device) so a
 * device that already subscribed just refreshes its keys/userAgent instead
 * of creating a duplicate row.
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
    const body = await request.json().catch(() => null);
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid push subscription",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { storeId: storeId!, userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      update: { storeId: storeId!, userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });

    return NextResponse.json(createSuccessResponse({ subscribed: true }));
  },
  { requireStoreAuth: true, rateLimitEndpoint: "/api/stores/[id]/push/subscribe" }
);
