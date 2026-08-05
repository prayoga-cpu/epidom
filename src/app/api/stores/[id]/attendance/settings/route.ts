import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { attendanceSettingsSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

/** GET /api/stores/[id]/attendance/settings — the overtime threshold. */
export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { standardWorkMinutesPerDay: true },
    });
    return NextResponse.json(
      createSuccessResponse({ standardWorkMinutesPerDay: store?.standardWorkMinutesPerDay ?? 480 })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/settings", requireStoreAuth: true }
);

/** PATCH /api/stores/[id]/attendance/settings — manager/owner only. */
export const PATCH = withApiHandler(
  async (request, { storeId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = attendanceSettingsSchema.safeParse(body);
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

    const store = await prisma.store.update({
      where: { id: storeId },
      data: { standardWorkMinutesPerDay: parsed.data.standardWorkMinutesPerDay },
      select: { standardWorkMinutesPerDay: true },
    });

    return NextResponse.json(createSuccessResponse(store));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/settings", requireStoreAuth: true }
);
