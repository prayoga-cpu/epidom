import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { staffScheduleSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { getActiveStaffSession } from "@/lib/staff-session";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/staff-schedules?from&to&staffId?&status?
 *
 * Serves both the manager's full roster grid and a staff member's own
 * "My Schedule" view from one endpoint. A restricted (non-manager/owner)
 * staff session can only ever see their own PUBLISHED rows — the `staffId`/
 * `status` query params are ignored (not just defaulted) for that caller,
 * so a restricted persona can't page through drafts or other staff's rows
 * by editing the URL.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const staffSession = await getActiveStaffSession();
    const isRestricted =
      !!staffSession &&
      staffSession.storeId === storeId &&
      staffSession.role !== "OWNER" &&
      staffSession.role !== "MANAGER";

    const staffId = isRestricted ? staffSession!.staffMemberId : searchParams.get("staffId");
    const status = isRestricted ? "PUBLISHED" : searchParams.get("status");

    const where: Prisma.StaffScheduleWhereInput = {
      storeId,
      ...(staffId && { staffMemberId: staffId }),
      ...(status && { status: status as Prisma.EnumScheduleStatusFilter["equals"] }),
      ...((from || to) && {
        date: {
          ...(from && { gte: businessDateKeyToDate(from) }),
          ...(to && { lte: businessDateKeyToDate(to) }),
        },
      }),
    };

    const schedules = await prisma.staffSchedule.findMany({
      where,
      include: {
        staffMember: { select: { id: true, name: true, role: true } },
        scheduleShift: true,
      },
      orderBy: [{ date: "asc" }],
    });

    return NextResponse.json(createSuccessResponse({ schedules }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules", requireStoreAuth: true }
);

/** POST /api/stores/[id]/staff-schedules — create one roster entry (defaults to DRAFT). Manager/owner only. */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const staffSession = await getActiveStaffSession();
    if (
      staffSession &&
      staffSession.storeId === storeId &&
      staffSession.role !== "OWNER" &&
      staffSession.role !== "MANAGER"
    ) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "Only an owner or manager can do this"),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = staffScheduleSchema.safeParse(body);
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
    const {
      staffMemberId,
      date,
      scheduleShiftId,
      customStartTime,
      customEndTime,
      isDayOff,
      department,
      notes,
    } = parsed.data;

    const staff = await prisma.staffMember.findUnique({ where: { id: staffMemberId } });
    if (!staff || staff.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
        { status: 404 }
      );
    }

    const schedule = await prisma.staffSchedule.create({
      data: {
        storeId,
        staffMemberId,
        date: businessDateKeyToDate(date),
        scheduleShiftId: scheduleShiftId ?? null,
        customStartTime: customStartTime ?? null,
        isDayOff: isDayOff ?? false,
        customEndTime: customEndTime ?? null,
        department: department ?? null,
        notes: notes || null,
      },
      include: {
        staffMember: { select: { id: true, name: true, role: true } },
        scheduleShift: true,
      },
    });

    return NextResponse.json(createSuccessResponse({ schedule }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules", requireStoreAuth: true }
);
