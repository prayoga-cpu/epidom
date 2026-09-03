import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { toDecimal } from "@/lib/utils/types.server";
import { getShiftCashOnHand } from "@/lib/services/cash-drawer.service";

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
  async (request, { storeId, params }) => {
    const { shiftId } = params as { shiftId: string };

    // No `orders` include: getShiftCashOnHand runs its own scoped queries, and
    // pulling every order of the session just to sum a subset was wasted work.
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

    const { closingCash, notes } = parsed.data;

    // One shared computation with the daily report, the Finance cash tab and
    // the dashboard card — see lib/finance/cash-drawer.ts. The formula that
    // used to live here counted DELIVERED-but-unpaid cash orders as money in
    // the drawer, never subtracted refunds, and knew nothing about tips, float
    // top-ups, paid-outs or safe drops, so it reported a false over/short on
    // any day those happened.
    //
    // The persisted expectedCash/cashDifference are a snapshot of the moment of
    // closing. The report recomputes live, so a movement backdated into this
    // window after the fact shows up there without rewriting this row.
    const breakdown = await getShiftCashOnHand(storeId!, shift, closingCash);
    const expectedCash = breakdown.expectedCash;
    // Non-null in practice: closingCash was passed as the override above, so the
    // breakdown always has a count to compare against. Recomputed rather than
    // `?? 0` because toDecimal(null) silently writes 0.00, which would read as
    // "the drawer balanced perfectly" — the one wrong answer this must not give.
    const cashDifference = breakdown.cashDifference ?? closingCash - expectedCash;

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
