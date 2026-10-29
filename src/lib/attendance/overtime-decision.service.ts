import { prisma } from "@/lib/prisma";
import { fetchHoursReport, getStoreHoursSettings } from "@/lib/attendance/fetch-hours-report";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import {
  isOvertimeDecidable,
  nextOvertimeDecision,
  overtimeDecisionKey,
} from "@/lib/attendance/overtime-approval";
import type { OvertimeDecider } from "@/lib/attendance/overtime-decider";

/**
 * Approving or turning down overtime for staff-days. Shared by
 * POST /attendance/overtime (the Hours tab) and the Claude connector's
 * decide_overtime, so both decide the same minutes the same way. Callers
 * have already checked that the person may decide overtime at this store.
 */

/** Same ceiling as the reports (resolveReportRange): a year, with slack. */
const MAX_RANGE_DAYS = 400;

/**
 * Why a requested day wasn't decided:
 *  - notFound:     no such staff member on this store;
 *  - owner:        the owner's own staff row isn't on the payroll;
 *  - self:         nobody approves their own overtime — a manager's goes to the owner;
 *  - notDecidable: no overtime that day, or the day isn't finished (still on
 *                  the clock, or a clock-out missing — correct it first);
 *  - alreadyDecided: none of the day's overtime is waiting — undo it first to
 *                  change a decision.
 */
export type OvertimeSkipReason = "notFound" | "owner" | "self" | "notDecidable" | "alreadyDecided";

export const OVERTIME_SKIP_MESSAGES: Record<OvertimeSkipReason, string> = {
  notFound: "Staff member not found",
  owner: "The owner's own hours aren't paid through payroll",
  self: "You can't approve your own overtime — the owner does",
  notDecidable: "There's no finished overtime to decide on that day",
  alreadyDecided: "That day's overtime is already decided — undo it to change it",
};

export class OvertimeApprovalOffError extends Error {
  constructor() {
    super("Overtime approval is turned off for this store");
    this.name = "OvertimeApprovalOffError";
  }
}

export class OvertimeRangeError extends Error {
  constructor() {
    super("Invalid date range");
    this.name = "OvertimeRangeError";
  }
}

export interface OvertimeDayKey {
  staffMemberId: string;
  /** Business-local "YYYY-MM-DD". */
  date: string;
}

export interface OvertimeDecisionResult {
  /** Distinct staff-days asked for (duplicates collapse). */
  requested: number;
  decided: number;
  /** Waiting minutes the decision applied to. */
  minutes: number;
  skipped: Array<OvertimeDayKey & { reason: OvertimeSkipReason }>;
}

/**
 * Decide the WAITING overtime of each staff-day, as the server computes it now
 * — the same rows the Hours and Salary tabs show — never a number from the
 * caller; minutes already decided keep their decision (nextOvertimeDecision).
 * Days that can't be decided are skipped and listed.
 *
 * `resolveDecider` runs only once the store's approval is known to be on.
 *
 * @throws OvertimeApprovalOffError when the store doesn't use overtime approval.
 * @throws OvertimeRangeError when the days span more than the reports allow.
 */
export async function decideOvertime(
  storeId: string,
  decision: "APPROVED" | "REJECTED",
  requestedDays: OvertimeDayKey[],
  resolveDecider: () => Promise<OvertimeDecider>
): Promise<OvertimeDecisionResult> {
  const settings = await getStoreHoursSettings(storeId);
  if (!settings.overtimeRequiresApproval) throw new OvertimeApprovalOffError();

  const days = [
    ...new Map(
      requestedDays.map((d) => [overtimeDecisionKey(d.staffMemberId, d.date), d])
    ).values(),
  ];
  const dates = days.map((d) => d.date).sort();
  const fromKey = dates[0];
  const toKey = dates[dates.length - 1];
  const span =
    (businessDateKeyToDate(toKey).getTime() - businessDateKeyToDate(fromKey).getTime()) /
    86_400_000;
  if (Number.isNaN(span) || span > MAX_RANGE_DAYS) throw new OvertimeRangeError();

  const staffIds = [...new Set(days.map((d) => d.staffMemberId))];
  const [decider, staff, hours] = await Promise.all([
    resolveDecider(),
    prisma.staffMember.findMany({
      where: { storeId, id: { in: staffIds } },
      select: { id: true, role: true },
    }),
    fetchHoursReport({
      storeId,
      fromKey,
      toKey,
      staffId: staffIds.length === 1 ? staffIds[0] : null,
      settings,
    }),
  ]);
  const roleById = new Map(staff.map((s) => [s.id, s.role]));
  const rowByDay = new Map(
    hours.rows.map((row) => [overtimeDecisionKey(row.staffMemberId, row.date), row])
  );

  const skipped: OvertimeDecisionResult["skipped"] = [];
  const toDecide: {
    staffMemberId: string;
    date: string;
    minutes: number;
    approvedMinutes: number;
    waitingMinutes: number;
  }[] = [];
  for (const day of days) {
    const role = roleById.get(day.staffMemberId);
    const row = rowByDay.get(overtimeDecisionKey(day.staffMemberId, day.date));
    const reason: OvertimeSkipReason | null = !role
      ? "notFound"
      : role === "OWNER"
        ? "owner"
        : day.staffMemberId === decider.staffMemberId
          ? "self"
          : !row || !isOvertimeDecidable(row)
            ? "notDecidable"
            : row.overtime.pendingMinutes === 0
              ? "alreadyDecided"
              : null;
    if (reason || !row) {
      skipped.push({ ...day, reason: reason ?? "notDecidable" });
      continue;
    }
    toDecide.push({
      ...day,
      ...nextOvertimeDecision(row.overtimeMinutes, row.overtime, decision),
      waitingMinutes: row.overtime.pendingMinutes,
    });
  }

  // A single-day request that can't be decided writes nothing: the caller
  // reports the reason instead.
  if (days.length === 1 && skipped.length === 1) {
    return { requested: 1, decided: 0, minutes: 0, skipped };
  }

  const decidedAt = new Date();
  const fields = {
    decision,
    decidedByUserId: decider.userId,
    decidedByStaffMemberId: decider.staffMemberId,
    decidedByName: decider.name,
    decidedAt,
  };
  await prisma.$transaction(
    toDecide.map((day) =>
      prisma.overtimeApproval.upsert({
        where: {
          staffMemberId_date: {
            staffMemberId: day.staffMemberId,
            date: businessDateKeyToDate(day.date),
          },
        },
        create: {
          storeId,
          staffMemberId: day.staffMemberId,
          date: businessDateKeyToDate(day.date),
          minutes: day.minutes,
          approvedMinutes: day.approvedMinutes,
          ...fields,
        },
        update: { minutes: day.minutes, approvedMinutes: day.approvedMinutes, ...fields },
      })
    )
  );

  return {
    requested: days.length,
    decided: toDecide.length,
    minutes: toDecide.reduce((sum, d) => sum + d.waitingMinutes, 0),
    skipped,
  };
}
