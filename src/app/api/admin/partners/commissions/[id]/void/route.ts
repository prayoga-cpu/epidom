import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { voidCommissionSchema } from "@/lib/validation/partner.schemas";
import { voidCommission } from "@/lib/services/partner.service";

/** POST /api/admin/partners/commissions/[id]/void: cancel a commission not yet paid. Full admins only. */
export const POST = withAdminApiHandler(async (req, { params, admin }) => {
  const body = await req.json().catch(() => null);
  const parsed = voidCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await voidCommission(params.id, parsed.data.reason, admin.id);
  return NextResponse.json({ ok: true });
});
