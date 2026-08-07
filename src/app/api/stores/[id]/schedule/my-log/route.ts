import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { fetchUnifiedLog } from "@/lib/attendance/unified-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/stores/[id]/schedule/my-log?staffId=&take=
 *
 * A staff member's own recent clock-in/out/absence + till cash history,
 * shown on the Schedule page's staff (self-service) view. Scoped to a
 * single staffId, same self-service trust boundary as
 * /attendance/history — this dialog/page already gates who can act as a
 * given staff member via their PIN, so seeing that same person's own
 * recent history isn't a new boundary.
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

    const records = (await fetchUnifiedLog({ storeId: storeId!, staffId })).slice(0, take);

    return NextResponse.json(createSuccessResponse({ records }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule/my-log", requireStoreAuth: true }
);
