import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireOwnerOnlyApi } from "@/lib/auth/require-owner-only";
import { closeTillShift, findOwnerStaffMemberId } from "@/lib/services/shift-close.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/shifts/[shiftId]/close
 *
 * The owner's override from the Back Office /shifts page: closes ANY open till,
 * whoever opened it — the way out when the cashier who opened it has gone home
 * without finishing, since the POS lets only the opener close a shift
 * (PATCH /shifts/[shiftId]).
 *
 * Owner only: requireOwnerOnlyApi turns away a cashier or manager persona on
 * the owner's device, and a linked staff account never gets here because this
 * route is absent from the default-deny staff policy table.
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const denied = await requireOwnerOnlyApi(storeId!);
    if (denied) return denied;

    const { shiftId } = params as { shiftId: string };
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });

    if (!shift || shift.storeId !== storeId) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"), {
        status: 404,
      });
    }

    if (shift.closedAt) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Shift is already closed"),
        { status: 409 }
      );
    }

    const body = await request.json();
    const parsed = closeShiftSchema.safeParse(body);
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

    const closed = await closeTillShift({
      storeId: storeId!,
      shift,
      closingCash: parsed.data.closingCash,
      notes: parsed.data.notes,
      closedByStaffMemberId: await findOwnerStaffMemberId(storeId!),
      fromBackOffice: true,
    });
    if (!closed) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Shift is already closed"),
        { status: 409 }
      );
    }

    return NextResponse.json(createSuccessResponse({ shift: closed }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts/[shiftId]/close", requireStoreAuth: true }
);
