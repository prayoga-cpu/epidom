import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { createSuccessResponse } from "@/types/api/responses";
import { newsletterAudienceQuerySchema } from "@/lib/validation/newsletter.schemas";
import {
  countByAudience,
  loadNewsletterContacts,
  selectRecipients,
} from "@/lib/services/newsletter-audience.service";
import { validationFailed } from "@/lib/newsletter/api-responses";

/**
 * GET /api/admin/newsletter/audience?audiences=FREE,PAID&language=fr: how
 * many people each audience holds today, and how many distinct addresses the
 * chosen ones add up to (someone in two audiences gets one email). Customer
 * groups are re-read when a campaign sends, so a scheduled one's count can move.
 */
export const GET = withAdminApiHandler(
  async (request) => {
    const url = new URL(request.url);
    const parsed = newsletterAudienceQuerySchema.safeParse({
      audiences: url.searchParams.get("audiences") ?? undefined,
      language: url.searchParams.get("language") ?? undefined,
    });
    if (!parsed.success) return validationFailed(parsed.error);
    const contacts = await loadNewsletterContacts();
    return NextResponse.json(
      createSuccessResponse({
        byAudience: countByAudience(contacts, parsed.data.language),
        total: selectRecipients(contacts, parsed.data.audiences, parsed.data.language).length,
      })
    );
  },
  { section: "newsletter" }
);
