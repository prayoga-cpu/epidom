import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listShiftsQuerySchema, openShiftSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { toDecimal } from "@/lib/utils/types.server";
import { isStaffAuthenticated } from "@/lib/attendance/verify-staff-auth";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const parsed = listShiftsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid query",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }
    // "open" is the store's live till, "closed" is history; omitted is both. Filtered in
    // SQL rather than by the caller scanning `take` rows: the newest row is usually a
    // closed shift, which would hide an open one behind it.
    const { take, skip, status, staffId } = parsed.data;

    const where = {
      storeId,
      ...(staffId && { staffMemberId: staffId }),
      ...(status === "open" && { closedAt: null }),
      ...(status === "closed" && { closedAt: { not: null } }),
    };

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          staffMember: { select: { id: true, name: true, role: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { openedAt: "desc" },
        take,
        skip,
      }),
      prisma.shift.count({ where }),
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
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
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

    if (!(await isStaffAuthenticated(storeId!, staffId, pin, staff.pin))) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, pin ? "Incorrect PIN" : "PIN required"),
        { status: 401 }
      );
    }

    // Only one open shift per STORE at a time. The till is the shop's drawer, not
    // a person's: every persona on every device signed in to the store shares it
    // (see useActiveShift), so a second one opened by another staff member would
    // be a second drawer nobody else can see, with sales split between the two.
    const openShift = await prisma.shift.findFirst({
      where: { storeId, closedAt: null },
    });
    if (openShift) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "This store already has an open shift"),
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
