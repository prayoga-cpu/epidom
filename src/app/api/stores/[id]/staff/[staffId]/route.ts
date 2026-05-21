import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { staffId } = params as { staffId: string };

    const existing = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { pin, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (pin) updateData.pin = await hash(pin, 10);

    const staff = await prisma.staffMember.update({
      where: { id: staffId },
      data: updateData,
      select: { id: true, name: true, role: true, isActive: true, updatedAt: true },
    });

    return NextResponse.json(createSuccessResponse({ staff }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]", requireStoreAuth: true }
);

export const DELETE = withApiHandler(
  async (_req, { storeId, params }) => {
    const { staffId } = params as { staffId: string };

    const existing = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!existing || existing.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
        { status: 404 }
      );
    }

    // Soft-delete: deactivate rather than hard delete (preserve shift history)
    await prisma.staffMember.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return NextResponse.json(createSuccessResponse({ deleted: staffId }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]", requireStoreAuth: true }
);
