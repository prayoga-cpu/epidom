import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { scheduleShiftSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

/** GET /api/stores/[id]/schedule-shifts — the named time-block templates (e.g. "Shift 1"). */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const scheduleShifts = await prisma.scheduleShift.findMany({
      where: { storeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(createSuccessResponse({ scheduleShifts }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-shifts", requireStoreAuth: true }
);

/** POST /api/stores/[id]/schedule-shifts — manager/owner only. */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = scheduleShiftSchema.safeParse(body);
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

    const existing = await prisma.scheduleShift.findFirst({
      where: { storeId, name: parsed.data.name },
    });
    if (existing) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "A shift block with this name already exists"),
        { status: 409 }
      );
    }

    const scheduleShift = await prisma.scheduleShift.create({
      data: {
        // storeId is guaranteed to be defined because requireStoreAuth is true
        storeId: storeId!,
        name: parsed.data.name,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        color: parsed.data.color || null,
      },
    });

    return NextResponse.json(createSuccessResponse({ scheduleShift }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-shifts", requireStoreAuth: true }
);
