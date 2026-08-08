import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";
import { sendStaffPinEmail } from "@/lib/services/email.service";
import { ALL_STAFF_PAGES } from "@/config/staff-permissions.config";

const OWNER_ONLY_PAGES = new Set(["/profile", "/billing", "/staff"]);
function sanitizeAllowedPages(pages: string[] | undefined): string[] | undefined {
  if (!pages) return undefined;
  return pages.filter((p) => ALL_STAFF_PAGES.includes(p) && !OWNER_ONLY_PAGES.has(p));
}

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_req, { storeId }) => {
    const staff = await prisma.staffMember.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        whatsapp: true,
        role: true,
        customRoleLabel: true,
        allowedPages: true,
        isActive: true,
        inviteStatus: true,
        payType: true,
        payRate: true,
        createdAt: true,
        updatedAt: true,
        pin: true,
      },
      orderBy: { name: "asc" },
    });

    const staffResponse = staff.map(({ pin, payRate, ...s }) => ({
      ...s,
      hasPin: pin !== null,
      payRate: payRate !== null ? Number(payRate) : null,
    }));

    return NextResponse.json(createSuccessResponse({ staff: staffResponse }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);
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

    const { name, username, email, whatsapp, role, customRoleLabel, allowedPages, pin, sendInvite } =
      parsed.data;
    const pinHash = pin && pin !== "" ? await hash(pin, 10) : null;
    const emailVal = email && email.trim() !== "" ? email.trim() : undefined;
    const whatsappVal = whatsapp && whatsapp !== "" ? whatsapp : undefined;
    const customRoleLabelVal =
      customRoleLabel && customRoleLabel.trim() !== "" ? customRoleLabel.trim() : undefined;

    const usernameTaken = await prisma.staffMember.findFirst({
      where: { storeId: storeId!, username },
      select: { id: true },
    });
    if (usernameTaken) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "Username is already taken", {
          fieldErrors: { username: ["Username is already taken"] },
        }),
        { status: 409 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { name: true },
    });

    const staff = await prisma.staffMember.create({
      data: {
        storeId: storeId!,
        name,
        username,
        email: emailVal,
        whatsapp: whatsappVal,
        role,
        customRoleLabel: customRoleLabelVal,
        allowedPages: sanitizeAllowedPages(allowedPages) ?? [],
        pin: pinHash,
        inviteStatus: emailVal && sendInvite ? "pending" : null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        whatsapp: true,
        role: true,
        customRoleLabel: true,
        allowedPages: true,
        isActive: true,
        inviteStatus: true,
        createdAt: true,
      },
    });

    // Fire-and-forget: don't block the response on email delivery
    if (emailVal && sendInvite && pin && pin !== "") {
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
