import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { getActiveStaffSession } from "@/lib/staff-session";
import { partnerBankDetailsSchema } from "@/lib/validation/partner.schemas";
import { setPartnerBankDetails } from "@/lib/services/partner.service";

/**
 * PUT /api/partner/me/bank-details: a partner saves where Epidom transfers
 * their commission. Their own partner only (an account that is not a partner has none),
 * never while a staff PIN persona is active. Stored encrypted.
 */
export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (!access?.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const persona = await getActiveStaffSession();
  if (persona && persona.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = partnerBankDetailsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const view = await setPartnerBankDetails(access.partnerId, parsed.data);
  return NextResponse.json(view);
}
