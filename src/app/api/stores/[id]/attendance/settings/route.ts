import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { attendanceSettingsSchema } from "@/lib/validation/attendance.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { requireOwnerWithoutStaffPersonaApi } from "@/lib/auth/require-owner-only";

export const dynamic = "force-dynamic";

const SETTINGS_SELECT = {
  standardWorkMinutesPerDay: true,
  overtimeRequiresApproval: true,
} as const;

/** GET /api/stores/[id]/attendance/settings — the overtime threshold and whether overtime needs approval. */
export const GET = withApiHandler(
  async (_request, { storeId }) => {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: SETTINGS_SELECT,
    });
    return NextResponse.json(
      createSuccessResponse({
        standardWorkMinutesPerDay: store?.standardWorkMinutesPerDay ?? 480,
        overtimeRequiresApproval: store?.overtimeRequiresApproval ?? false,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/settings", requireStoreAuth: true }
);

/**
 * PATCH /api/stores/[id]/attendance/settings — the standard hours are a
 * manager's or the owner's to set; whether overtime needs approval is the
 * owner's alone (a manager could otherwise switch it off to have their own
 * overtime paid without anyone approving it).
 */
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

    const { standardWorkMinutesPerDay, overtimeRequiresApproval } = parsed.data;
    if (overtimeRequiresApproval !== undefined) {
      const ownerGuard = await requireOwnerWithoutStaffPersonaApi(storeId!);
      if (ownerGuard) return ownerGuard;
    }

    const store = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(standardWorkMinutesPerDay !== undefined && { standardWorkMinutesPerDay }),
        ...(overtimeRequiresApproval !== undefined && { overtimeRequiresApproval }),
      },
      select: SETTINGS_SELECT,
    });

    return NextResponse.json(createSuccessResponse(store));
  },
  { rateLimitEndpoint: "/api/stores/[id]/attendance/settings", requireStoreAuth: true }
);
