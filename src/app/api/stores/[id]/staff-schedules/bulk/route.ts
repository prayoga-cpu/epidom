import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { staffScheduleBulkSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { createRosterEntries, RosterStaffNotFoundError } from "@/lib/services/roster.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/staff-schedules/bulk
 *
 * The week-grid "Save" action — creates a batch of DRAFT roster entries in
 * one request. Manager/owner only.
 */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = staffScheduleBulkSchema.safeParse(body);
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

    let schedules;
    try {
      // storeId is guaranteed to be defined because requireStoreAuth is true
      schedules = await createRosterEntries(storeId!, parsed.data.entries);
    } catch (error) {
      if (error instanceof RosterStaffNotFoundError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
      }
      throw error;
    }

    return NextResponse.json(createSuccessResponse({ schedules, count: schedules.length }), {
      status: 201,
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff-schedules/bulk", requireStoreAuth: true }
);
