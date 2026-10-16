import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { overtimeDecisionSchema, overtimeUndoSchema } from "@/lib/validation/attendance.schemas";
import { fetchHoursReport, getStoreHoursSettings } from "@/lib/attendance/fetch-hours-report";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import {
  isOvertimeDecidable,
  nextOvertimeDecision,
  overtimeDecisionKey,
} from "@/lib/attendance/overtime-approval";
import {
  guardOvertimeDecisionApi,
  resolveOvertimeDecider,
} from "@/lib/attendance/overtime-decider";

export const dynamic = "force-dynamic";

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
type SkipReason = "notFound" | "owner" | "self" | "notDecidable" | "alreadyDecided";

const SKIP_MESSAGES: Record<SkipReason, string> = {
  notFound: "Staff member not found",
  owner: "The owner's own hours aren't paid through payroll",
  self: "You can't approve your own overtime — the owner does",
  notDecidable: "There's no finished overtime to decide on that day",
  alreadyDecided: "That day's overtime is already decided — undo it to change it",
};

/**
 * POST /api/stores/[id]/attendance/overtime
 *
 * Approve or turn down overtime for one or many staff-days (the Hours tab's
 * per-row buttons and its "Approve all"). Only while the store's overtime
 * approval is on. A decision applies to the day's WAITING minutes, as the
 * server computes them now — the same rows the Hours and Salary tabs show —
 * never a number from the client; minutes already decided keep their
 * decision (nextOvertimeDecision).
 *
 * Days that can't be decided are skipped and listed; a single-day request
 * that is skipped fails with the reason instead.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const denied = await guardOvertimeDecisionApi(storeId!);
    if (denied) return denied;

    const parsed = overtimeDecisionSchema.safeParse(await request.json());
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

    const settings = await getStoreHoursSettings(storeId!);
    if (!settings.overtimeRequiresApproval) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.CONFLICT,
          "Overtime approval is turned off for this store"
        ),
        { status: 409 }
      );
    }

    const days = [
      ...new Map(
        parsed.data.days.map((d) => [overtimeDecisionKey(d.staffMemberId, d.date), d])
      ).values(),
    ];
    const dates = days.map((d) => d.date).sort();
    const fromKey = dates[0];
    const toKey = dates[dates.length - 1];
    const span =
      (businessDateKeyToDate(toKey).getTime() - businessDateKeyToDate(fromKey).getTime()) /
      86_400_000;
    if (Number.isNaN(span) || span > MAX_RANGE_DAYS) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        {
          status: 400,
        }
      );
    }

    const staffIds = [...new Set(days.map((d) => d.staffMemberId))];
    const [decider, staff, hours] = await Promise.all([
      resolveOvertimeDecider(storeId!),
      prisma.staffMember.findMany({
        where: { storeId, id: { in: staffIds } },
        select: { id: true, role: true },
      }),
      fetchHoursReport({
        storeId: storeId!,
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

    const skipped: { staffMemberId: string; date: string; reason: SkipReason }[] = [];
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
      const reason: SkipReason | null = !role
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
        ...nextOvertimeDecision(row.overtimeMinutes, row.overtime, parsed.data.decision),
        waitingMinutes: row.overtime.pendingMinutes,
      });
    }

    if (days.length === 1 && skipped.length === 1) {
      const reason = skipped[0].reason;
      return NextResponse.json(
        createErrorResponse(
          reason === "self"
            ? ApiErrorCode.FORBIDDEN
            : reason === "notFound"
              ? ApiErrorCode.NOT_FOUND
              : ApiErrorCode.CONFLICT,
          SKIP_MESSAGES[reason],
          { reason }
        ),
        { status: reason === "self" ? 403 : reason === "notFound" ? 404 : 409 }
      );
    }

    const decidedAt = new Date();
    const fields = {
      decision: parsed.data.decision,
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
            storeId: storeId!,
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

    return NextResponse.json(
      createSuccessResponse({
        decision: parsed.data.decision,
        decided: toDecide.length,
        minutes: toDecide.reduce((sum, d) => sum + d.waitingMinutes, 0),
        skipped,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/overtime", requireStoreAuth: true }
);

/**
 * DELETE /api/stores/[id]/attendance/overtime?staffMemberId&date
 *
 * Undo a decision: the day's overtime goes back to waiting (and out of pay)
 * until it's decided again. Allowed with approval turned off too, so an old
 * decision can still be cleared.
 */
export const DELETE = withApiHandler(
  async (request, { storeId }) => {
    const denied = await guardOvertimeDecisionApi(storeId!);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const parsed = overtimeUndoSchema.safeParse(Object.fromEntries(searchParams));
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
    const { staffMemberId, date } = parsed.data;

    const decider = await resolveOvertimeDecider(storeId!);
    if (decider.staffMemberId === staffMemberId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, SKIP_MESSAGES.self, { reason: "self" }),
        { status: 403 }
      );
    }

    const { count } = await prisma.overtimeApproval.deleteMany({
      where: { storeId, staffMemberId, date: businessDateKeyToDate(date) },
    });
    if (count === 0) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "No decision on that day"),
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(createSuccessResponse({ removed: count }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/overtime", requireStoreAuth: true }
);
