import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { newsletterCampaignInputSchema } from "@/lib/validation/newsletter.schemas";
import { createCampaign } from "@/lib/services/newsletter-campaign.service";
import { validationFailed } from "@/lib/newsletter/api-responses";

/** GET /api/admin/newsletter/campaigns: every campaign, without its content. */
export const GET = withAdminApiHandler(
  async () => {
    const campaigns = await prisma.newsletterCampaign.findMany({
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
      take: 500,
      select: {
        id: true,
        subject: true,
        previewText: true,
        audiences: true,
        language: true,
        status: true,
        scheduledAt: true,
        timezone: true,
        sentAt: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        lastError: true,
        createdBy: true,
        updatedBy: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(createSuccessResponse({ campaigns }));
  },
  { section: "newsletter" }
);

/** POST /api/admin/newsletter/campaigns: a new draft, or scheduled straight away. */
export const POST = withAdminApiHandler(
  async (request, { admin }) => {
    const parsed = newsletterCampaignInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationFailed(parsed.error);
    const campaign = await createCampaign(parsed.data, admin.email);
    return NextResponse.json(createSuccessResponse({ campaign }), { status: 201 });
  },
  { section: "newsletter" }
);
