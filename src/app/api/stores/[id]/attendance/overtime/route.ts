import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { overtimeDecisionSchema, overtimeUndoSchema } from "@/lib/validation/attendance.schemas";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import {
  decideOvertime,
  OVERTIME_SKIP_MESSAGES,
  OvertimeApprovalOffError,
  OvertimeRangeError,
} from "@/lib/attendance/overtime-decision.service";
import {
  guardOvertimeDecisionApi,
  resolveOvertimeDecider,
} from "@/lib/attendance/overtime-decider";

export const dynamic = "force-dynamic";

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

    let result;
    try {
      result = await decideOvertime(storeId!, parsed.data.decision, parsed.data.days, () =>
        resolveOvertimeDecider(storeId!)
      );
    } catch (error) {
      if (error instanceof OvertimeApprovalOffError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, error.message), {
          status: 409,
        });
      }
      if (error instanceof OvertimeRangeError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, error.message), {
          status: 400,
        });
      }
      throw error;
    }

    if (result.requested === 1 && result.skipped.length === 1) {
      const reason = result.skipped[0].reason;
      return NextResponse.json(
        createErrorResponse(
          reason === "self"
            ? ApiErrorCode.FORBIDDEN
            : reason === "notFound"
              ? ApiErrorCode.NOT_FOUND
              : ApiErrorCode.CONFLICT,
          OVERTIME_SKIP_MESSAGES[reason],
          { reason }
        ),
        { status: reason === "self" ? 403 : reason === "notFound" ? 404 : 409 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        decision: parsed.data.decision,
        decided: result.decided,
        minutes: result.minutes,
        skipped: result.skipped,
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
        createErrorResponse(ApiErrorCode.FORBIDDEN, OVERTIME_SKIP_MESSAGES.self, { reason: "self" }),
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
