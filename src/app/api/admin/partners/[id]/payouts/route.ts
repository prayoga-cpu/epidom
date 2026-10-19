import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { recordPayoutSchema } from "@/lib/validation/partner.schemas";
import { recordPayout } from "@/lib/services/partner.service";

/**
 * POST /api/admin/partners/[id]/payouts: record a bank transfer that paid
 * everything ready in one currency. Full admins only (no section): it moves money.
 */
export const POST = withAdminApiHandler(async (req, { params, admin }) => {
  const body = await req.json().catch(() => null);
  const parsed = recordPayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const payout = await recordPayout(params.id, parsed.data, admin.id);
  return NextResponse.json(
    { payout: { id: payout.id, amount: payout.amount.toString(), currency: payout.currency } },
    { status: 201 }
  );
});
