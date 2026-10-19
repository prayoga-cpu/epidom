import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { setPartnerSalesPagesSchema } from "@/lib/validation/partner.schemas";
import { setPartnerSalesPages } from "@/lib/services/partner.service";

/**
 * PUT /api/admin/partners/[id]/sales-pages: the sales pages this partner owns
 * (the whole list), each with the date its sign-ups are credited from.
 */
export const PUT = withAdminApiHandler(
  async (req, { params, admin }) => {
    const body = await req.json().catch(() => null);
    const parsed = setPartnerSalesPagesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(await setPartnerSalesPages(params.id, parsed.data, admin.id));
  },
  { section: "partners" }
);
