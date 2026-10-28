import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { readyToSendIssues } from "@/lib/validation/newsletter.schemas";
import { sendCampaignNow } from "@/lib/services/newsletter-campaign.service";
import { campaignMiss } from "@/lib/newsletter/api-responses";

/**
 * POST /api/admin/newsletter/campaigns/[id]/send-now: send a saved draft or
 * scheduled campaign now. `via: "dispatcher"` means Inngest didn't take the
 * event and the 5-minute dispatcher will send it instead.
 */
export const POST = withAdminApiHandler(
  async (_request, { params, admin }) => {
    const campaign = await prisma.newsletterCampaign.findUnique({
      where: { id: params.id },
      select: { subject: true, contentHtml: true, audiences: true },
    });
    if (!campaign) return campaignMiss("not_found");
    const issues = readyToSendIssues(campaign);
    if (issues.length > 0) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.VALIDATION_ERROR, issues[0]), {
        status: 400,
      });
    }
    const result = await sendCampaignNow(params.id, admin.email);
    if (!result.ok) return campaignMiss(result.reason);
    return NextResponse.json(createSuccessResponse({ via: result.via }));
  },
  { section: "newsletter" }
);
