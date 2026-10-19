import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { removePartnerViewer } from "@/lib/services/partner.service";

/** DELETE /api/admin/partners/[id]/viewers/[userId]: stop an account seeing this partner's page. */
export const DELETE = withAdminApiHandler(
  async (_req, { params, admin }) => {
    await removePartnerViewer(params.id, params.userId, admin.id);
    return NextResponse.json({ ok: true });
  },
  { section: "partners" }
);
