import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { createPartnerSchema } from "@/lib/validation/partner.schemas";
import { createPartner, listPartners } from "@/lib/services/partner.service";

/** GET /api/admin/partners: every partner with their deal, pages and commission totals. */
export const GET = withAdminApiHandler(
  async () => NextResponse.json({ partners: await listPartners() }),
  { section: "partners" }
);

/** POST /api/admin/partners: make an account a partner, or invite an email to become one. */
export const POST = withAdminApiHandler(
  async (req, { admin }) => {
    const body = await req.json().catch(() => null);
    const parsed = createPartnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { partner, invited } = await createPartner(parsed.data, admin.id);
    return NextResponse.json({ partner, invited }, { status: 201 });
  },
  { section: "partners" }
);
