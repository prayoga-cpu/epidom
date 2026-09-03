import { prisma } from "@/lib/prisma";
import type { Decimal } from "@prisma/client/runtime/client";
import type { CashMovementType } from "@prisma/client";
import { CASH_MOVEMENT_DIRECTION } from "@/lib/finance/cash-drawer";

/**
 * The merged "who did what, when" log behind the Schedule page's Log tab —
 * combines AttendanceRecord (clock-in/out/absence), Shift (till cash
 * open/close, rendered as synthetic Cash In/Out events) and CashMovement
 * (the real non-sale cash ledger: tips, float top-ups, paid-outs, safe drops,
 * tip payouts) into one chronological list. Neither Shift nor CashMovement is
 * mutated here — this only reads them and projects them into log rows.
 *
 * The two kinds of cash row are deliberately not merged into one concept: a
 * shift's opening/closing count is a *statement of what is in the drawer*,
 * while a movement is *money crossing the drawer*. They just happen to answer
 * the same manager question ("where did the cash go today?"), so they share a
 * timeline.
 */
export type UnifiedLogType = "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";

export interface UnifiedLogRow {
  id: string;
  timestamp: string;
  /**
   * Nullable because a CashMovement can be unattributed — the API leaves it
   * null rather than pinning an owner-recorded row on some staff member (see
   * the POST route's "confident wrong answer" note). Attendance and shift rows
   * always carry one.
   */
  staffMemberId: string | null;
  staffName: string;
  type: UnifiedLogType;
  selfieUrl: string | null;
  locationLabel: string | null;
  notes: string | null;
  amount: number | null;
}

/** Shown for an unattributed cash movement — a dash, not a translated word, so
 * it needs no locale plumbing through the API into three surfaces. */
const UNATTRIBUTED_STAFF_NAME = "—";

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

export interface CashMovementInput {
  id: string;
  staffMemberId: string | null;
  staffMember: { name: string } | null;
  type: CashMovementType;
  /** Always positive in the database; direction comes from `type`. */
  amount: Decimal | number;
  reason: string | null;
  occurredAt: Date;
}

export interface MergeUnifiedLogParams {
  attendanceRecords: AttendanceRecordInput[];
  shifts: ShiftInput[];
  /** Optional so callers that predate the cash ledger keep compiling; an
   * absent list simply contributes no rows. */
  cashMovements?: CashMovementInput[];
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
  cashMovements = [],
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

    for (const movement of cashMovements) {
      // CASH_MOVEMENT_DIRECTION is the single source of truth for which way a
      // movement pushes the drawer (lib/finance/cash-drawer.ts). A second
      // direction table here would be one deploy away from disagreeing with
      // the expected-cash arithmetic on the same screen.
      const type: UnifiedLogType =
        CASH_MOVEMENT_DIRECTION[movement.type] === 1 ? "CASH_IN" : "CASH_OUT";
      if ((!types || types.includes(type)) && inRange(movement.occurredAt)) {
        rows.push({
          // Prefixed so it can never collide with the synthetic `${shift.id}-in`
          // / `-out` ids above — these rows share a React list.
          id: `movement-${movement.id}`,
          timestamp: movement.occurredAt.toISOString(),
          staffMemberId: movement.staffMemberId,
          staffName: movement.staffMember?.name ?? UNATTRIBUTED_STAFF_NAME,
          type,
          selfieUrl: null,
          locationLabel: null,
          // The "where did the money go" justification the API demands for
          // outbound types — the whole point of the row, so it must reach the
          // log, not just the ledger.
          notes: movement.reason,
          amount: Number(movement.amount),
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

  const [attendanceRecords, shifts, cashMovements] = await Promise.all([
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
    wantsCash
      ? prisma.cashMovement.findMany({
          where: {
            storeId,
            ...(staffId && { staffMemberId: staffId }),
            // Keyed on occurredAt, not createdAt — a paid-out entered ten
            // minutes late still belongs to the moment the cash moved, which
            // is also what the drawer arithmetic filters on.
            ...((from || to) && {
              occurredAt: { ...(from && { gte: from }), ...(to && { lte: to }) },
            }),
          },
          select: {
            id: true,
            staffMemberId: true,
            type: true,
            amount: true,
            reason: true,
            occurredAt: true,
            staffMember: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return mergeUnifiedLog({ attendanceRecords, shifts, cashMovements, from, to, types });
}
