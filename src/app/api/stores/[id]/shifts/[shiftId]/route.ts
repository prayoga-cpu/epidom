import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import {
  closeTillShift,
  isShiftOpener,
  resolveShiftActor,
} from "@/lib/services/shift-close.service";
import { NOT_SHIFT_OPENER } from "@/lib/constants/shift-close";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_req, { storeId, params }) => {
    const { shiftId } = params as { shiftId: string };
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        staffMember: { select: { id: true, name: true, role: true } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paymentMethod: true,
            status: true,
            orderDate: true,
          },
        },
      },
    });

    if (!shift || shift.storeId !== storeId) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"), {
        status: 404,
      });
    }

    return NextResponse.json(createSuccessResponse({ shift }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts/[shiftId]", requireStoreAuth: true }
);

export const PATCH = withApiHandler(
  async (request, { storeId, params, access }) => {
    const { shiftId } = params as { shiftId: string };

    // No `orders` include: getShiftCashOnHand runs its own scoped queries, and
    // pulling every order of the session just to sum a subset was wasted work.
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

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

    // Only the person who opened the till signs it off here. Everyone else —
    // including a manager, and the owner's POS persona for a cashier's shift —
    // is sent to the owner, who can close it from the Back Office
    // (POST /shifts/[shiftId]/close). Decided from the session and PIN cookie,
    // never from anything in the body.
    const actor = await resolveShiftActor(storeId!, access);
    if (!isShiftOpener(actor, shift.staffMember)) {
      const openedBy = shift.staffMember?.name ?? null;
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          openedBy
            ? `Only ${openedBy} can end this shift. The owner can close it from the Back Office.`
            : "Only the person who opened this shift can end it. The owner can close it from the Back Office.",
          { reason: NOT_SHIFT_OPENER, openedBy }
        ),
        { status: 403 }
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
      // The owner may only reach this line for a shift the owner opened.
      closedByStaffMemberId: actor.kind === "staff" ? actor.staffMemberId : shift.staffMemberId,
      fromBackOffice: false,
    });
    if (!closed) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Shift is already closed"),
        { status: 409 }
      );
    }

    return NextResponse.json(createSuccessResponse({ shift: closed }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts/[shiftId]", requireStoreAuth: true }
);
