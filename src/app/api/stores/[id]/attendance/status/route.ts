import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/attendance/status?staffId=
 *
 * Tells the clock-in/out dialog which action to default to: is this staff
 * member currently clocked in (an open CLOCK_IN with no later CLOCK_OUT)?
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "staffId is required"),
        { status: 400 }
      );
    }

    const lastClockIn = await prisma.attendanceRecord.findFirst({
      where: { storeId, staffMemberId: staffId, type: "CLOCK_IN" },
      orderBy: { timestamp: "desc" },
    });

    if (!lastClockIn) {
      return NextResponse.json(createSuccessResponse({ isClockedIn: false, openRecord: null }));
    }

    const closedBy = await prisma.attendanceRecord.findFirst({
      where: {
        storeId,
        staffMemberId: staffId,
        type: "CLOCK_OUT",
        timestamp: { gt: lastClockIn.timestamp },
      },
    });

    return NextResponse.json(
      createSuccessResponse({
        isClockedIn: !closedBy,
        openRecord: closedBy ? null : lastClockIn,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/status", requireStoreAuth: true }
);
