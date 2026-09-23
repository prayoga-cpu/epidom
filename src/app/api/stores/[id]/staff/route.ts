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
  async (_req, { storeId, access }) => {
    // A linked staff account (its own login) reaches this route only to fill
    // the PIN picker — and the picker for THEM is just themselves. It must
    // not receive a coworker's contact details, pay rate, or PIN status, so
    // it gets its own row, minimal fields only (what StoreAccessGate uses).
    if (access?.accessType === "staff") {
      const me = await prisma.staffMember.findFirst({
        where: { id: access.staffMemberId, storeId, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          customRoleLabel: true,
          allowedPages: true,
          isActive: true,
          pin: true,
        },
      });
      const staff = me
        ? [
            {
              id: me.id,
              name: me.name,
              role: me.role,
              customRoleLabel: me.customRoleLabel,
              allowedPages: me.allowedPages,
              isActive: me.isActive,
              hasPin: me.pin !== null,
            },
          ]
        : [];
      return NextResponse.json(createSuccessResponse({ staff }));
    }

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
        contractType: true,
        createdAt: true,
        updatedAt: true,
        pin: true,
        userId: true,
      },
      orderBy: { name: "asc" },
    });

    // Sign-in invites still waiting to be claimed. Derived, not stored on the
    // row: `inviteStatus` is exactly the field that says "accepted" the moment
    // a PIN email was merely SENT, and a second status string on StaffMember
    // would invite the same confusion.
    const pendingInvites = await prisma.staffInvite.findMany({
      where: {
        storeId,
        staffMemberId: { in: staff.map((s) => s.id) },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { staffMemberId: true },
    });
    const pendingIds = new Set(pendingInvites.map((i) => i.staffMemberId));

    // userId is a Better Auth account id — the client only needs to know
    // whether one is linked, not which.
    const staffResponse = staff.map(({ pin, payRate, userId, ...s }) => ({
      ...s,
      hasPin: pin !== null,
      payRate: payRate !== null ? Number(payRate) : null,
      hasLinkedAccount: userId !== null,
      hasPendingAccountInvite: userId === null && pendingIds.has(s.id),
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
