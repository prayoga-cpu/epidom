import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { requireOwnerOnlyApi } from "@/lib/auth/require-owner-only";
import { sendStaffAccountInviteEmail } from "@/lib/services/email.service";
import {
  STAFF_INVITE_TTL_MS,
  buildStaffInviteUrl,
  generateStaffInviteToken,
} from "@/lib/staff-invite";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/**
 * POST /api/stores/[id]/staff/[staffId]/invite
 *
 * Emails a staff member a single-use link to claim (or create) their own
 * Epidom sign-in, linked to their StaffMember row. Owner-only: a linked staff
 * account must never be able to mint access for anyone. That holds twice over
 * — this route is absent from the staff policy table
 * (src/lib/auth/staff-principal-policy.ts), so a staff account is refused
 * before the handler runs, and requireOwnerOnlyApi below also refuses a
 * restricted PIN persona on the owner's own device.
 *
 * Unlike the PIN email (fire-and-forget, flips inviteStatus to "accepted" the
 * moment the send is attempted), this awaits delivery and only reports
 * success when the mail provider actually accepted it.
 */
export const POST = withApiHandler(
  async (_request, { storeId, params, userId }) => {
    const denied = await requireOwnerOnlyApi(storeId!);
    if (denied) return denied;

    const { staffId } = params as { staffId: string };

    const staff = await prisma.staffMember.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        storeId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        userId: true,
      },
    });
    if (!staff || staff.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
        { status: 404 }
      );
    }
    if (staff.role === "OWNER") {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "The account owner already signs in with their own account"
        ),
        { status: 400 }
      );
    }
    if (!staff.isActive) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Reactivate this staff member before inviting them to sign in"
        ),
        { status: 400 }
      );
    }
    if (!staff.email) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Add a contact email first"),
        { status: 400 }
      );
    }
    if (staff.userId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.CONFLICT, "This staff member already has an account"),
        { status: 409 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { name: true },
    });

    // One live link per staff member: issuing a new one retires any earlier,
    // still-unclaimed one, so a link that ended up somewhere it shouldn't
    // stops working the moment the owner re-sends.
    const token = generateStaffInviteToken();
    const invite = await prisma.$transaction(async (tx) => {
      await tx.staffInvite.deleteMany({
        where: { staffMemberId: staff.id, consumedAt: null },
      });
      return tx.staffInvite.create({
        data: {
          storeId: storeId!,
          staffMemberId: staff.id,
          email: staff.email!,
          token,
          expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_MS),
          invitedByUserId: userId,
        },
        select: { id: true },
      });
    });

    const result = await sendStaffAccountInviteEmail(
      staff.email,
      staff.name,
      store?.name ?? "your store",
      buildStaffInviteUrl(token)
    );

    if (!result.success) {
      // Don't leave a live, never-delivered link behind.
      await prisma.staffInvite.delete({ where: { id: invite.id } }).catch(() => {});
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          "We couldn't send the invite email. Check the address and try again."
        ),
        { status: 502 }
      );
    }

    return NextResponse.json(createSuccessResponse({ sent: true }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/staff/[staffId]/invite",
    requireStoreAuth: true,
  }
);
