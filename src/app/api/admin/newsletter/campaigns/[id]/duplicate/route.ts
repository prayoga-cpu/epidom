import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { duplicateCampaign } from "@/lib/services/newsletter-campaign.service";

/** POST /api/admin/newsletter/campaigns/[id]/duplicate: a new draft from any campaign. */
export const POST = withAdminApiHandler(
  async (_request, { params, admin }) => {
    const campaign = await duplicateCampaign(params.id, admin.email);
    if (!campaign) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Newsletter not found"),
        {
          status: 404,
        }
      );
    }
    return NextResponse.json(createSuccessResponse({ campaign }), { status: 201 });
  },
  { section: "newsletter" }
);
