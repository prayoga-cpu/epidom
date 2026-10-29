import type { Prisma, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import type { StaffScheduleInput } from "@/lib/validation/scheduling.schemas";

/**
 * The staff roster (StaffSchedule rows): read a date range, add a batch of
 * DRAFT entries, publish a range. Shared by the /staff-schedules routes and
 * the Claude connector. Dates are business-local "YYYY-MM-DD" keys stored as
 * @db.Date (see src/lib/attendance/business-date.ts).
 */

export async function listRoster(
  storeId: string,
  query: {
    fromKey?: string | null;
    toKey?: string | null;
    staffMemberId?: string | null;
    status?: ScheduleStatus | null;
  }
) {
  const where: Prisma.StaffScheduleWhereInput = {
    storeId,
    ...(query.staffMemberId && { staffMemberId: query.staffMemberId }),
    ...(query.status && { status: query.status }),
    ...((query.fromKey || query.toKey) && {
      date: {
        ...(query.fromKey && { gte: businessDateKeyToDate(query.fromKey) }),
        ...(query.toKey && { lte: businessDateKeyToDate(query.toKey) }),
      },
    }),
  };

  return prisma.staffSchedule.findMany({
    where,
    include: {
      staffMember: { select: { id: true, name: true, role: true } },
      scheduleShift: true,
    },
    orderBy: [{ date: "asc" }],
  });
}

export class RosterStaffNotFoundError extends Error {
  constructor() {
    super("One or more staff members were not found");
    this.name = "RosterStaffNotFoundError";
  }
}

/**
 * Create roster entries as DRAFT, all or none — the week grid's "Save".
 *
 * @throws RosterStaffNotFoundError when an entry names someone not at this store.
 */
export async function createRosterEntries(storeId: string, entries: StaffScheduleInput[]) {
  const staffIds = [...new Set(entries.map((e) => e.staffMemberId))];
  const staffCount = await prisma.staffMember.count({
    where: { id: { in: staffIds }, storeId },
  });
  if (staffCount !== staffIds.length) throw new RosterStaffNotFoundError();

  return prisma.$transaction(
    entries.map((entry) =>
      prisma.staffSchedule.create({
        data: {
          storeId,
          staffMemberId: entry.staffMemberId,
          date: businessDateKeyToDate(entry.date),
          scheduleShiftId: entry.scheduleShiftId ?? null,
          customStartTime: entry.customStartTime ?? null,
          customEndTime: entry.customEndTime ?? null,
          isDayOff: entry.isDayOff ?? false,
          department: entry.department ?? null,
          notes: entry.notes || null,
        },
      })
    )
  );
}

/**
 * Publish every DRAFT entry in [fromKey, toKey] — what makes a roster visible
 * in staff's own "My Schedule" view.
 *
 * @returns how many entries were published.
 */
export async function publishRoster(
  storeId: string,
  fromKey: string,
  toKey: string
): Promise<number> {
  const { count } = await prisma.staffSchedule.updateMany({
    where: {
      storeId,
      status: "DRAFT",
      date: {
        gte: businessDateKeyToDate(fromKey),
        lte: businessDateKeyToDate(toKey),
      },
    },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return count;
}
