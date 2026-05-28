import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";
import { sendStaffPinEmail } from "@/lib/services/email.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_req, { storeId }) => {
    const staff = await prisma.staffMember.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        inviteStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(createSuccessResponse({ staff }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { name, email, role, pin, sendInvite } = parsed.data;
    const pinHash = await hash(pin, 10);
    const emailVal = email && email.trim() !== "" ? email.trim() : undefined;

    const store = await prisma.store.findUnique({ where: { id: storeId! }, select: { name: true } });

    const staff = await prisma.staffMember.create({
      data: {
        storeId: storeId!,
        name,
        email: emailVal,
        role,
        pin: pinHash,
        inviteStatus: emailVal && sendInvite ? "pending" : null,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, inviteStatus: true, createdAt: true },
    });

    // Fire-and-forget: don't block the response on email delivery
    if (emailVal && sendInvite) {
      sendStaffPinEmail(emailVal, name, store?.name ?? "your store", pin)
        .then(() =>
          prisma.staffMember.update({
            where: { id: staff.id },
            data: { inviteStatus: "accepted" },
          })
        )
        .catch((err) => console.error("[staff/invite] email send failed:", err));
    }

    return NextResponse.json(createSuccessResponse({ staff }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff", requireStoreAuth: true }
);
