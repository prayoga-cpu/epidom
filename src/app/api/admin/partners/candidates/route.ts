import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { searchPartnerCandidates } from "@/lib/services/partner.service";

/**
 * GET /api/admin/partners/candidates?q=: accounts the "New referral partner"
 * picker can offer (name or email match, not already partners, at most 20).
 * Section "partners": a referrals admin can pick users without the users list.
 */
export const GET = withAdminApiHandler(
  async (req) => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
    return NextResponse.json({ users: await searchPartnerCandidates(q) });
  },
  { section: "partners" }
);
