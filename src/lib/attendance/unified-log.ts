import { prisma } from "@/lib/prisma";
import type { Decimal } from "@prisma/client/runtime/client";

/**
 * The merged "who did what, when" log behind the Schedule page's Log tab —
 * combines AttendanceRecord (clock-in/out/absence) and Shift (till cash
 * open/close, rendered as synthetic Cash In/Out events) into one
 * chronological list. Shift itself is untouched — this only reads it and
 * projects openedAt/closedAt into two possible log rows.
 */
export type UnifiedLogType = "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";

export interface UnifiedLogRow {
  id: string;
  timestamp: string;
  staffMemberId: string;
  staffName: string;
  type: UnifiedLogType;
  selfieUrl: string | null;
  locationLabel: string | null;
  notes: string | null;
  amount: number | null;
}

export interface AttendanceRecordInput {
  id: string;
  staffMemberId: string;
  staffMember: { name: string };
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE";
  timestamp: Date;
  selfieUrl: string | null;
  locationLabel: string | null;
  notes: string | null;
}

export interface ShiftInput {
  id: string;
  staffMemberId: string;
  staffMember: { name: string };
  openedAt: Date;
  closedAt: Date | null;
  openingCash: Decimal | number;
  closingCash: Decimal | number | null;
  notes: string | null;
}

export interface MergeUnifiedLogParams {
  attendanceRecords: AttendanceRecordInput[];
  shifts: ShiftInput[];
  from?: Date;
  to?: Date;
  types?: UnifiedLogType[];
}

const ATTENDANCE_TYPES = new Set<UnifiedLogType>(["CLOCK_IN", "CLOCK_OUT", "ABSENCE"]);
const CASH_TYPES = new Set<UnifiedLogType>(["CASH_IN", "CASH_OUT"]);

/**
 * Pure, DB-free merge — kept separate from the Prisma fetch below so it's
 * directly unit-testable, same convention as hours-aggregation.ts.
 */
export function mergeUnifiedLog({
  attendanceRecords,
  shifts,
  from,
  to,
  types,
}: MergeUnifiedLogParams): UnifiedLogRow[] {
  const wantsAttendance = !types || types.some((t) => ATTENDANCE_TYPES.has(t));
  const wantsCash = !types || types.some((t) => CASH_TYPES.has(t));
  const inRange = (date: Date) => (!from || date >= from) && (!to || date <= to);

  const rows: UnifiedLogRow[] = [];

  if (wantsAttendance) {
    for (const record of attendanceRecords) {
      if ((!types || types.includes(record.type)) && inRange(record.timestamp)) {
        rows.push({
          id: record.id,
          timestamp: record.timestamp.toISOString(),
          staffMemberId: record.staffMemberId,
          staffName: record.staffMember.name,
          type: record.type,
          selfieUrl: record.selfieUrl,
          locationLabel: record.locationLabel,
          notes: record.notes,
          amount: null,
        });
      }
    }
  }

  if (wantsCash) {
    for (const shift of shifts) {
      if ((!types || types.includes("CASH_IN")) && inRange(shift.openedAt)) {
        rows.push({
          id: `${shift.id}-in`,
          timestamp: shift.openedAt.toISOString(),
          staffMemberId: shift.staffMemberId,
          staffName: shift.staffMember.name,
          type: "CASH_IN",
          selfieUrl: null,
          locationLabel: null,
          notes: shift.notes,
          amount: Number(shift.openingCash),
        });
      }
      if ((!types || types.includes("CASH_OUT")) && shift.closedAt && inRange(shift.closedAt)) {
        rows.push({
          id: `${shift.id}-out`,
          timestamp: shift.closedAt.toISOString(),
          staffMemberId: shift.staffMemberId,
          staffName: shift.staffMember.name,
          type: "CASH_OUT",
          selfieUrl: null,
          locationLabel: null,
          notes: shift.notes,
          amount: shift.closingCash != null ? Number(shift.closingCash) : null,
        });
      }
    }
  }

  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return rows;
}

export interface FetchUnifiedLogParams {
  storeId: string;
  from?: Date;
  to?: Date;
  staffId?: string;
  types?: UnifiedLogType[];
}

export async function fetchUnifiedLog({
  storeId,
  from,
  to,
  staffId,
  types,
}: FetchUnifiedLogParams): Promise<UnifiedLogRow[]> {
  const wantsAttendance = !types || types.some((t) => ATTENDANCE_TYPES.has(t));
  const wantsCash = !types || types.some((t) => CASH_TYPES.has(t));

  const [attendanceRecords, shifts] = await Promise.all([
    wantsAttendance
      ? prisma.attendanceRecord.findMany({
          where: {
            storeId,
            ...(staffId && { staffMemberId: staffId }),
            ...((from || to) && {
              timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) },
            }),
          },
          include: { staffMember: { select: { name: true } } },
          orderBy: { timestamp: "desc" },
        })
      : Promise.resolve([]),
    wantsCash
      ? prisma.shift.findMany({
          where: {
            storeId,
            ...(staffId && { staffMemberId: staffId }),
            ...((from || to) && {
              OR: [
                { openedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } },
                { closedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } },
              ],
            }),
          },
          include: { staffMember: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return mergeUnifiedLog({ attendanceRecords, shifts, from, to, types });
}
