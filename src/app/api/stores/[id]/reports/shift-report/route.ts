/**
 * GET /api/stores/[id]/reports/shift-report
 *
 * The shift / daily report ("X-report", "Z-report") as JSON: sales breakdown,
 * invoice counts, cancellations, sale-type split, guest stats, payment-method
 * split, per-product breakdown by category, and — when scoped to a till
 * session — cash-drawer reconciliation.
 *
 * Consumed by the client-side ESC/POS thermal print path. The browser report
 * page calls buildShiftReport() directly server-side instead of round-tripping
 * through here; both share the same service, so the two can't disagree.
 *
 * Query params: shiftId (wins), or from/to as full ISO datetimes.
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { shiftReportQuerySchema } from "@/lib/validation/reports.schemas";
import { buildShiftReport } from "@/lib/services/shift-report.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const parsed = shiftReportQuerySchema.safeParse({
      shiftId: searchParams.get("shiftId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
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

    const result = await buildShiftReport(storeId!, {
      shiftId: parsed.data.shiftId,
      from: parsed.data.from ? new Date(parsed.data.from) : null,
      to: parsed.data.to ? new Date(parsed.data.to) : null,
    });

    if (!result.ok) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"), {
        status: 404,
      });
    }

    return NextResponse.json(
      createSuccessResponse({
        report: result.report,
        shiftLabel: result.shiftLabel,
        storeName: result.storeName,
        currency: result.currency,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/reports/shift-report", requireStoreAuth: true }
);
