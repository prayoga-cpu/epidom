import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { retryCampaign } from "@/lib/services/newsletter-campaign.service";
import { campaignMiss } from "@/lib/newsletter/api-responses";

/**
 * POST /api/admin/newsletter/campaigns/[id]/retry: resume a FAILED campaign.
 * Recipients already emailed are not emailed again.
 */
export const POST = withAdminApiHandler(
  async (_request, { params, admin }) => {
    const result = await retryCampaign(params.id, admin.email);
    if (!result.ok) return campaignMiss(result.reason);
    return NextResponse.json(createSuccessResponse({ via: result.via }));
  },
  { section: "newsletter" }
);
