import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { addPartnerViewerSchema } from "@/lib/validation/partner.schemas";
import { addPartnerViewer } from "@/lib/services/partner.service";

/** POST /api/admin/partners/[id]/viewers: let an account see this partner's page, read-only. */
export const POST = withAdminApiHandler(
  async (req, { params, admin }) => {
    const body = await req.json().catch(() => null);
    const parsed = addPartnerViewerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the account's email" }, { status: 400 });
    }
    await addPartnerViewer(params.id, parsed.data.email, admin.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  },
  { section: "partners" }
);
