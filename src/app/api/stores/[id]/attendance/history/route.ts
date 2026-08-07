import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/attendance/history?staffId=&take=
 *
 * A staff member's own recent clock-in/out/absence log, shown inside the
 * clock-in/out dialog itself (not the manager audit trail at
 * /api/stores/[id]/attendance — that one's manager/owner only). Scoped to a
 * single staffId at a time, same trust boundary as clock-in/out/status: this
 * dialog already gates who can act as a given staff member via their PIN, so
 * seeing that same person's own recent history isn't a new boundary.
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
    const take = Math.min(Math.max(Number(searchParams.get("take") ?? "10"), 1), 20);

    const records = await prisma.attendanceRecord.findMany({
      where: { storeId, staffMemberId: staffId },
      select: {
        id: true,
        type: true,
        timestamp: true,
        selfieUrl: true,
        locationLabel: true,
        notes: true,
      },
      orderBy: { timestamp: "desc" },
      take,
    });

    return NextResponse.json(createSuccessResponse({ records }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/history", requireStoreAuth: true }
);
