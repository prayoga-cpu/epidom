import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { fetchUnifiedLog, type UnifiedLogType } from "@/lib/attendance/unified-log";

export const dynamic = "force-dynamic";

const VALID_TYPES: UnifiedLogType[] = ["CLOCK_IN", "CLOCK_OUT", "ABSENCE", "CASH_IN", "CASH_OUT"];

/**
 * GET /api/stores/[id]/schedule/log?from&to&staffId?&type?
 *
 * The manager-facing chronological log behind two Back Office pages: the
 * Schedule page's attendance log (CLOCK_IN, CLOCK_OUT, ABSENCE) and the Shifts
 * page's cash log (CASH_IN, CASH_OUT — a till's opening/closing count and every
 * cash movement). They are separate pages on purpose: who was on the clock and
 * what was in the drawer are different questions. Each asks for its own kind.
 *
 * `type` is one type or a comma-separated list; omitted means every kind, for
 * callers that predate the split. Manager/owner only, same trust boundary as the
 * old /attendance audit route this absorbs.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    // Unknown entries are dropped; if none survive it is "no filter", not "match
    // nothing" — same as the single-type behaviour this replaced.
    const requested = (searchParams.get("type") ?? "")
      .split(",")
      .map((type) => type.trim())
      .filter((type): type is UnifiedLogType => VALID_TYPES.includes(type as UnifiedLogType));
    const types = requested.length > 0 ? requested : undefined;

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((from && Number.isNaN(fromDate?.getTime())) || (to && Number.isNaN(toDate?.getTime()))) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }

    const records = await fetchUnifiedLog({
      storeId: storeId!,
      from: fromDate,
      to: toDate,
      staffId,
      types,
    });

    return NextResponse.json(createSuccessResponse({ records }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule/log", requireStoreAuth: true }
);
