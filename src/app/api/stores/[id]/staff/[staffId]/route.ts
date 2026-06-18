import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash, compare } from "bcryptjs";
import { sendStaffPinEmail } from "@/lib/services/email.service";

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

    const { pin, email, sendPinEmail, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (email !== undefined) {
      updateData.email = email && email.trim() !== "" ? email.trim() : null;
    }
    if (pin !== undefined) {
      if (pin === "") {
        updateData.pin = null;
      } else {
        updateData.pin = await hash(pin, 10);
      }
    }

    const store = await prisma.store.findUnique({ where: { id: storeId! }, select: { name: true } });

    const staff = await prisma.staffMember.update({
      where: { id: staffId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true, inviteStatus: true, updatedAt: true },
    });

    // Send PIN email if requested and we have an email + a PIN
    if (sendPinEmail && pin) {
      const targetEmail = (updateData.email as string | null) ?? existing.email;
      if (targetEmail) {
        sendStaffPinEmail(targetEmail, existing.name, store?.name ?? "your store", pin)
          .then(() =>
            prisma.staffMember.update({ where: { id: staffId }, data: { inviteStatus: "accepted" } })
          )
          .catch((err) => console.error("[staff/resend-pin] email send failed:", err));
      }
    }

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

    await prisma.staffMember.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return NextResponse.json(createSuccessResponse({ deleted: staffId }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]", requireStoreAuth: true }
);
