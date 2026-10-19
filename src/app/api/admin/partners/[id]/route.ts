import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { updatePartnerSchema } from "@/lib/validation/partner.schemas";
import { getPartnerDetail, updatePartner } from "@/lib/services/partner.service";

/** GET /api/admin/partners/[id]: the partner, their customers, ledger and payouts. */
export const GET = withAdminApiHandler(
  async (_req, { params, admin }) =>
    NextResponse.json(
      await getPartnerDetail(params.id, new Date(), { includeBankDetails: admin.full })
    ),
  { section: "partners" }
);

/** PATCH /api/admin/partners/[id]: change the deal (new sign-ups only) or the status. */
export const PATCH = withAdminApiHandler(
  async (req, { params, admin }) => {
    const body = await req.json().catch(() => null);
    const parsed = updatePartnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const partner = await updatePartner(params.id, parsed.data, admin.id);
    return NextResponse.json({ partner: { id: partner.id } });
  },
  { section: "partners" }
);
