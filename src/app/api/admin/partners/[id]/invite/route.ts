import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { resendPartnerInvite } from "@/lib/services/partner.service";

/** POST /api/admin/partners/[id]/invite: email a pending partner a new invitation link. */
export const POST = withAdminApiHandler(
  async (_req, { params, admin }) => {
    await resendPartnerInvite(params.id, admin.id);
    return NextResponse.json({ ok: true });
  },
  { section: "partners" }
);
