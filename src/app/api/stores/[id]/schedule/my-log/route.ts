import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { fetchUnifiedLog } from "@/lib/attendance/unified-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/schedule/my-log?staffId=&take=&from=&to=
 *
 * A staff member's own recent clock-in/out/absence + till cash history,
 * shown on the Schedule page's staff (self-service) view. Scoped to a
 * single staffId, same self-service trust boundary as
 * /attendance/history — this dialog/page already gates who can act as a
 * given staff member via their PIN, so seeing that same person's own
 * recent history isn't a new boundary. from/to (same shape as the
 * manager-facing /schedule/log route) let the caller scope to a custom
 * date range instead of just "the most recent N."
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "staffId is required"),
        { status: 400 }
      );
    }
    const take = Math.min(Math.max(Number(searchParams.get("take") ?? "20"), 1), 50);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((from && Number.isNaN(fromDate?.getTime())) || (to && Number.isNaN(toDate?.getTime()))) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid from/to date"),
        { status: 400 }
      );
    }

    const records = (
      await fetchUnifiedLog({ storeId: storeId!, staffId, from: fromDate, to: toDate })
    ).slice(0, take);

    return NextResponse.json(createSuccessResponse({ records }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule/my-log", requireStoreAuth: true }
);
