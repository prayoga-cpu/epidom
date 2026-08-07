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
 * The Schedule page's manager-facing Log tab — merges attendance clock
 * events and till cash open/close into one chronological, filterable list.
 * Manager/owner only, same trust boundary as the old /attendance audit
 * route this absorbs.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const typeParam = searchParams.get("type");
    const types =
      typeParam && VALID_TYPES.includes(typeParam as UnifiedLogType)
        ? [typeParam as UnifiedLogType]
        : undefined;

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
