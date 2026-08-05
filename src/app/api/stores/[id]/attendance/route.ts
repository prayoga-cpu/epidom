import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/attendance
 *
 * The manager audit trail: every clock-in/out/absence event, filterable by
 * staff member and date range. Manager/owner only — this is the audit
 * surface the selfie+geolocation capture exists to support.
 *
 * Query params: staffId?, from?, to?, type?, take?, skip?
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const take = Math.min(Number(searchParams.get("take") ?? "50"), 200);
    const skip = Number(searchParams.get("skip") ?? "0");

    const where: Prisma.AttendanceRecordWhereInput = {
      storeId,
      ...(staffId && { staffMemberId: staffId }),
      ...(type && { type: type as Prisma.EnumAttendanceTypeFilter["equals"] }),
      ...((from || to) && {
        timestamp: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include: {
          staffMember: { select: { id: true, name: true, role: true } },
          staffSchedule: {
            select: { id: true, date: true, scheduleShift: { select: { name: true } } },
          },
        },
        orderBy: { timestamp: "desc" },
        take,
        skip,
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return NextResponse.json(createSuccessResponse({ records, total }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance", requireStoreAuth: true }
);
