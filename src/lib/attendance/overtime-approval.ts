/**
 * Which of a day's overtime minutes are paid — the one rule the Hours tab,
 * the Salary tab, a staff member's My Pay and Finance's Labour tab all read.
 * Pure and DB-free (the Prisma fetch is fetch-hours-report.ts), same
 * convention as hours-report.ts.
 *
 * With Store.overtimeRequiresApproval off, every overtime minute is paid, as
 * it always was. With it on, a day's overtime waits until a manager or the
 * owner decides it (an OvertimeApproval row). The row records how many of
 * the day's minutes have been decided and how many of those were approved.
 * Minutes added later — a clock-out corrected to a later time — wait for a
 * decision of their own, and deciding them never touches the minutes already
 * decided (see nextOvertimeDecision): approving the extra doesn't approve
 * what was rejected, rejecting it doesn't take back what was approved.
 */

export type OvertimeDecisionValue = "APPROVED" | "REJECTED";

export interface OvertimeDecisionInput {
  staffMemberId: string;
  /** Business-local "YYYY-MM-DD". */
  date: string;
  /** The latest action on the day. */
  decision: OvertimeDecisionValue;
  /** How many of the day's overtime minutes have been decided. */
  minutes: number;
  /** Of those, how many were approved. */
  approvedMinutes: number;
  decidedAt: string;
  decidedByName: string;
}

/**
 *  - none:      no overtime that day.
 *  - automatic: approval is off — paid as recorded.
 *  - pending:   some or all of it is waiting for a decision.
 *  - approved / rejected: all of it decided the same way.
 *  - partial:   all decided, some approved and the rest rejected (a day
 *               that grew after its first decision).
 */
export type OvertimeStatus = "none" | "automatic" | "pending" | "approved" | "rejected" | "partial";

export interface DayOvertime {
  status: OvertimeStatus;
  /** Counts toward pay. */
  paidMinutes: number;
  /** Waiting for a decision — not paid yet. */
  pendingMinutes: number;
  /** Turned down — never paid. */
  rejectedMinutes: number;
  /** The decision on record, even when the day no longer has overtime to apply it to. */
  decision: Omit<OvertimeDecisionInput, "staffMemberId" | "date"> | null;
}

export function overtimeDecisionKey(staffMemberId: string, date: string): string {
  return `${staffMemberId}:${date}`;
}

export function resolveDayOvertime(
  overtimeMinutes: number,
  decision: OvertimeDecisionInput | undefined,
  requiresApproval: boolean
): DayOvertime {
  const recorded = decision
    ? {
        decision: decision.decision,
        minutes: decision.minutes,
        approvedMinutes: decision.approvedMinutes,
        decidedAt: decision.decidedAt,
        decidedByName: decision.decidedByName,
      }
    : null;

  if (overtimeMinutes <= 0) {
    return {
      status: "none",
      paidMinutes: 0,
      pendingMinutes: 0,
      rejectedMinutes: 0,
      decision: recorded,
    };
  }
  if (!requiresApproval) {
    return {
      status: "automatic",
      paidMinutes: overtimeMinutes,
      pendingMinutes: 0,
      rejectedMinutes: 0,
      decision: recorded,
    };
  }
  if (!decision) {
    return {
      status: "pending",
      paidMinutes: 0,
      pendingMinutes: overtimeMinutes,
      rejectedMinutes: 0,
      decision: null,
    };
  }

  // A day that shrank since (a clock-out corrected to earlier) pays at most
  // what it has now.
  const covered = Math.min(overtimeMinutes, Math.max(0, decision.minutes));
  const paidMinutes = Math.min(covered, Math.max(0, decision.approvedMinutes));
  const rejectedMinutes = covered - paidMinutes;
  const pendingMinutes = overtimeMinutes - covered;
  return {
    status:
      pendingMinutes > 0
        ? "pending"
        : rejectedMinutes === 0
          ? "approved"
          : paidMinutes === 0
            ? "rejected"
            : "partial",
    paidMinutes,
    pendingMinutes,
    rejectedMinutes,
    decision: recorded,
  };
}

/**
 * What to store when a day's WAITING overtime is approved or rejected: every
 * minute the day has is now decided, and the approved count grows by the
 * waiting minutes only on an approval. Minutes already decided keep their
 * decision — to change one, undo the day and decide it again.
 */
export function nextOvertimeDecision(
  overtimeMinutes: number,
  current: DayOvertime,
  action: OvertimeDecisionValue
): { minutes: number; approvedMinutes: number } {
  return {
    minutes: overtimeMinutes,
    approvedMinutes:
      action === "APPROVED" ? current.paidMinutes + current.pendingMinutes : current.paidMinutes,
  };
}

/**
 * Can a decision be made on this day right now? Only a finished day with
 * overtime: while someone is still on the clock, or a clock-in was never
 * closed, the overtime isn't final, and approving it would approve a number
 * that is about to change. (Whether any of it is still waiting is the
 * row's `overtime.pendingMinutes`.)
 */
export function isOvertimeDecidable(day: { status: string; overtimeMinutes: number }): boolean {
  return day.status === "worked" && day.overtimeMinutes > 0;
}

/** Each row with its `overtime` resolved against the store's decisions. */
export function applyOvertimeDecisions<
  T extends { staffMemberId: string; date: string; overtimeMinutes: number },
>(
  rows: T[],
  decisions: OvertimeDecisionInput[],
  requiresApproval: boolean
): (T & { overtime: DayOvertime })[] {
  const byDay = new Map(decisions.map((d) => [overtimeDecisionKey(d.staffMemberId, d.date), d]));
  return rows.map((row) => ({
    ...row,
    overtime: resolveDayOvertime(
      row.overtimeMinutes,
      byDay.get(overtimeDecisionKey(row.staffMemberId, row.date)),
      requiresApproval
    ),
  }));
}
