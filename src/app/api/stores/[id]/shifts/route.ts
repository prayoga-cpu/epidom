import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { compare } from "bcryptjs";
import { toDecimal } from "@/lib/utils/types.server";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("take") ?? "20"), 100);
    const skip = Number(searchParams.get("skip") ?? "0");

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where: { storeId },
        include: {
          staffMember: { select: { id: true, name: true, role: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { openedAt: "desc" },
        take,
        skip,
      }),
      prisma.shift.count({ where: { storeId } }),
    ]);

    return NextResponse.json(createSuccessResponse({ shifts, total }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = openShiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { staffId, pin, openingCash } = parsed.data;

    const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff || staff.storeId !== storeId || !staff.isActive) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found or inactive"),
        { status: 404 }
      );
    }

    const pinValid = await compare(pin, staff.pin);
    if (!pinValid) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Incorrect PIN"),
        { status: 401 }
      );
    }

    // Only one open shift per staff member at a time
    const openShift = await prisma.shift.findFirst({
      where: { storeId, staffMemberId: staffId, closedAt: null },
    });
    if (openShift) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Staff member already has an open shift"),
        { status: 409 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        storeId,
        staffMemberId: staffId,
        openingCash: toDecimal(openingCash),
      },
      include: { staffMember: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json(createSuccessResponse({ shift }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/shifts", requireStoreAuth: true }
);
