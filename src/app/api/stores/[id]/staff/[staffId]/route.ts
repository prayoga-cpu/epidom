import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash, compare } from "bcryptjs";
import { sendStaffPinEmail } from "@/lib/services/email.service";
import { ALL_STAFF_PAGES } from "@/config/staff-permissions.config";
import { emailsMatch } from "@/lib/staff-invite";
import { requireOwnerWithoutStaffPersonaApi } from "@/lib/auth/require-owner-only";

const OWNER_ONLY_PAGES = new Set(["/profile", "/billing", "/staff"]);
function sanitizeAllowedPages(pages: string[] | undefined): string[] | undefined {
  if (!pages) return undefined;
  return pages.filter((p) => ALL_STAFF_PAGES.includes(p) && !OWNER_ONLY_PAGES.has(p));
}

export const dynamic = "force-dynamic";

// Owner only, like the Staff page that is the sole caller: this sets roles,
// page access, PINs and pay. Before the guard, any PIN persona on the owner's
// device could call it directly — a cashier could raise their own pay rate.
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const guard = await requireOwnerWithoutStaffPersonaApi(storeId!);
    if (guard) return guard;
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
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const {
      pin,
      email,
      whatsapp,
      username,
      customRoleLabel,
      allowedPages,
      sendPinEmail,
      allowances,
      ...rest
    } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (customRoleLabel !== undefined) {
      updateData.customRoleLabel = customRoleLabel.trim() !== "" ? customRoleLabel.trim() : null;
    }
    if (allowedPages !== undefined) {
      updateData.allowedPages = sanitizeAllowedPages(allowedPages) ?? [];
    }
    if (username !== undefined) {
      const usernameTaken = await prisma.staffMember.findFirst({
        where: { storeId: storeId!, username, NOT: { id: staffId } },
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
      updateData.username = username;
    }
    if (email !== undefined) {
      updateData.email = email && email.trim() !== "" ? email.trim() : null;
    }
    if (whatsapp !== undefined) {
      updateData.whatsapp = whatsapp && whatsapp !== "" ? whatsapp : null;
    }
    if (pin !== undefined) {
      if (pin === "") {
        updateData.pin = null;
      } else {
        updateData.pin = await hash(pin, 10);
      }
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { name: true },
    });

    // Allowances are saved as a whole list (the Contract card edits them all at
    // once), in the same transaction as the rest of the row.
    const staff = await prisma.$transaction(async (tx) => {
      if (allowances !== undefined) {
        await tx.staffAllowance.deleteMany({ where: { staffMemberId: staffId, storeId: storeId! } });
        if (allowances.length > 0) {
          await tx.staffAllowance.createMany({
            data: allowances.map((a) => ({
              storeId: storeId!,
              staffMemberId: staffId,
              name: a.name,
              amount: a.amount,
              basis: a.basis,
            })),
          });
        }
      }
      return tx.staffMember.update({
        where: { id: staffId },
        data: updateData,
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
          overtimeRate: true,
          contractType: true,
          updatedAt: true,
          allowances: {
            select: { id: true, name: true, amount: true, basis: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    // An outstanding sign-in invite belongs to the address it was sent to. If
    // the owner changed that address (usually because it was wrong) or turned
    // the person off, the old link must stop working. The claim path re-checks
    // both at claim time regardless; this keeps the "invite sent" state honest.
    const emailChanged =
      email !== undefined &&
      !emailsMatch((updateData.email as string | null) ?? "", existing.email ?? "");
    if (emailChanged || updateData.isActive === false) {
      await prisma.staffInvite.deleteMany({
        where: { staffMemberId: staffId, consumedAt: null },
      });
    }

    // Send PIN email if requested and we have an email + a PIN
    if (sendPinEmail && pin) {
      const targetEmail = (updateData.email as string | null) ?? existing.email;
      if (targetEmail) {
        sendStaffPinEmail(targetEmail, existing.name, store?.name ?? "your store", pin)
          .then(() =>
            prisma.staffMember.update({
              where: { id: staffId },
              data: { inviteStatus: "accepted" },
            })
          )
          .catch((err) => console.error("[staff/resend-pin] email send failed:", err));
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        staff: {
          ...staff,
          payRate: staff.payRate !== null ? Number(staff.payRate) : null,
          overtimeRate: staff.overtimeRate !== null ? Number(staff.overtimeRate) : null,
          allowances: staff.allowances.map((a) => ({ ...a, amount: Number(a.amount) })),
        },
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]", requireStoreAuth: true }
);

export const DELETE = withApiHandler(
  async (_req, { storeId, params }) => {
    const guard = await requireOwnerWithoutStaffPersonaApi(storeId!);
    if (guard) return guard;
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
    await prisma.staffInvite.deleteMany({
      where: { staffMemberId: staffId, consumedAt: null },
    });

    return NextResponse.json(createSuccessResponse({ deleted: staffId }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]", requireStoreAuth: true }
);
