/**
 * GET /api/stores/[id]/finance/by-schedule-shift
 *
 * Revenue/order-count per named shift-block (e.g. "Shift 1"), independently
 * per calendar date — a coverage-window report, not a partition, since
 * blocks can overlap by design. See schedule-shift-bucketing.ts. Also joins
 * PUBLISHED StaffSchedule rows for "who was rostered on" context — this is
 * NOT order-level revenue attribution (only a cashier's own till session,
 * via /finance/by-shift?staffId=, has that).
 *
 * Query params: from, to
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { bucketOrdersByScheduleShift, enumerateDateKeys } from "@/lib/finance/schedule-shift-bucketing";
import { getBusinessDateKey, businessDateKeyToDate } from "@/lib/attendance/business-date";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { business: { select: { timezone: true } } },
    });
    const timezone = store?.business.timezone ?? "UTC";

    const [scheduleShifts, orders] = await Promise.all([
      prisma.scheduleShift.findMany({
        where: { storeId, isActive: true },
        select: { id: true, name: true, startTime: true, endTime: true, color: true },
      }),
      prisma.order.findMany({
        where: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to } },
        select: { total: true, orderDate: true },
      }),
    ]);

    const fromKey = getBusinessDateKey(from, timezone);
    const toKey = getBusinessDateKey(to, timezone);
    const dateKeys = enumerateDateKeys(fromKey, toKey);

    const rows = bucketOrdersByScheduleShift(orders, scheduleShifts, dateKeys, timezone);

    const rosterRows = await prisma.staffSchedule.findMany({
      where: {
        storeId,
        status: "PUBLISHED",
        date: { gte: businessDateKeyToDate(fromKey), lte: businessDateKeyToDate(toKey) },
        scheduleShiftId: { not: null },
      },
      select: {
        date: true,
        scheduleShiftId: true,
        department: true,
        staffMember: { select: { id: true, name: true } },
      },
    });
    const rosterKey = (dateKey: string, scheduleShiftId: string) => `${dateKey}:${scheduleShiftId}`;
    const rosterMap = new Map<string, { staffMemberId: string; name: string; department: string | null }[]>();
    for (const r of rosterRows) {
      if (!r.scheduleShiftId) continue;
      const key = rosterKey(getBusinessDateKey(r.date, timezone), r.scheduleShiftId);
      const list = rosterMap.get(key) ?? [];
      list.push({ staffMemberId: r.staffMember.id, name: r.staffMember.name, department: r.department });
      rosterMap.set(key, list);
    }

    const colorByShiftId = new Map(scheduleShifts.map((s) => [s.id, s.color]));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        rows: rows.map((row) => ({
          ...row,
          color: colorByShiftId.get(row.scheduleShiftId) ?? null,
          staffOnDuty: rosterMap.get(rosterKey(row.date, row.scheduleShiftId)) ?? [],
        })),
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/by-schedule-shift", requireStoreAuth: true }
);
