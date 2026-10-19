import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { updateMyPartnerSchema } from "@/lib/validation/partner.schemas";
import { setMyReferralLanding } from "@/lib/services/partner.service";

/**
 * PATCH /api/partner/me: a partner picks where their referral link lands
 * (/register or the home page). The partner is always the signed-in account's
 * own; never while a staff PIN persona is active on the device.
 */
export async function PATCH(request: Request) {
  const access = await getAdminAccess();
  if (!access?.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const persona = await getActiveStaffSession();
  if (persona && persona.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateMyPartnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const partner = await setMyReferralLanding(access.partnerId, parsed.data.referralLanding);
  return NextResponse.json({ referralLanding: partner.referralLanding });
}
