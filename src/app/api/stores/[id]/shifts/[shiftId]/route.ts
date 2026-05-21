import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { toDecimal } from "@/lib/utils/types.server";
import { PaymentMethod } from "@prisma/client";

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
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse({ shift }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts/[shiftId]", requireStoreAuth: true }
);

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { shiftId } = params as { shiftId: string };

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { orders: { select: { total: true, paymentMethod: true, status: true } } },
    });

    if (!shift || shift.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"),
        { status: 404 }
      );
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
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { closingCash, notes } = parsed.data;

    // Expected cash = opening cash + all CASH orders in this shift
    const cashOrders = shift.orders.filter(
      (o) => o.paymentMethod === PaymentMethod.CASH && o.status !== "CANCELLED"
    );
    const cashTotal = cashOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const expectedCash = Number(shift.openingCash) + cashTotal;
    const cashDifference = closingCash - expectedCash;

    const closed = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        closedAt: new Date(),
        closingCash: toDecimal(closingCash),
        expectedCash: toDecimal(expectedCash),
        cashDifference: toDecimal(cashDifference),
        notes,
      },
      include: { staffMember: { select: { id: true, name: true } } },
    });

    return NextResponse.json(createSuccessResponse({ shift: closed }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts/[shiftId]", requireStoreAuth: true }
);
