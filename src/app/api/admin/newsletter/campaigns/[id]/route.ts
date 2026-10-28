import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { newsletterCampaignInputSchema } from "@/lib/validation/newsletter.schemas";
import { deleteCampaign, updateCampaign } from "@/lib/services/newsletter-campaign.service";
import { campaignMiss, validationFailed } from "@/lib/newsletter/api-responses";

/** GET /api/admin/newsletter/campaigns/[id]: the campaign with its content. */
export const GET = withAdminApiHandler(
  async (_request, { params }) => {
    const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: params.id } });
    if (!campaign) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Newsletter not found"),
        {
          status: 404,
        }
      );
    }
    return NextResponse.json(createSuccessResponse({ campaign }));
  },
  { section: "newsletter" }
);

/**
 * PATCH /api/admin/newsletter/campaigns/[id]: save the editor (the whole
 * editable state), which also schedules (status SCHEDULED) or unschedules
 * (status DRAFT). 409 once it has started sending.
 */
export const PATCH = withAdminApiHandler(
  async (request, { params, admin }) => {
    const parsed = newsletterCampaignInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationFailed(parsed.error);
    const result = await updateCampaign(params.id, parsed.data, admin.email);
    if (!result.ok) return campaignMiss(result.reason);
    return NextResponse.json(createSuccessResponse({ campaign: result.campaign }));
  },
  { section: "newsletter" }
);

/** DELETE /api/admin/newsletter/campaigns/[id]: drafts and scheduled ones only. */
export const DELETE = withAdminApiHandler(
  async (_request, { params }) => {
    const result = await deleteCampaign(params.id);
    if (!result.ok) return campaignMiss(result.reason);
    return NextResponse.json(createSuccessResponse({ deleted: true }));
  },
  { section: "newsletter" }
);
