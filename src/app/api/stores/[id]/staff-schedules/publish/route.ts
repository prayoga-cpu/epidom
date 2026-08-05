import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { publishScheduleSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/staff-schedules/publish
 *
 * Publishes every DRAFT roster entry within [from, to] — this is what makes
 * a roster visible in staff's own "My Schedule" view. Manager/owner only.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = publishScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const { count } = await prisma.staffSchedule.updateMany({
      where: {
        storeId,
        status: "DRAFT",
        date: {
          gte: businessDateKeyToDate(parsed.data.from),
          lte: businessDateKeyToDate(parsed.data.to),
        },
      },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    return NextResponse.json(createSuccessResponse({ publishedCount: count }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules/publish", requireStoreAuth: true }
);
