import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { ApiErrorCode, createErrorResponse, createSuccessResponse } from "@/types/api/responses";
import { newsletterTestSendSchema } from "@/lib/validation/newsletter.schemas";
import { sendNewsletterTest } from "@/lib/services/newsletter-campaign.service";
import { validationFailed } from "@/lib/newsletter/api-responses";

/** POST /api/admin/newsletter/test: send the editor's current content to one address. */
export const POST = withAdminApiHandler(
  async (request) => {
    const parsed = newsletterTestSendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationFailed(parsed.error);
    const result = await sendNewsletterTest(parsed.data);
    if (!result.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.SERVICE_UNAVAILABLE, result.error),
        {
          status: 502,
        }
      );
    }
    return NextResponse.json(createSuccessResponse({ sent: true }));
  },
  { section: "newsletter" }
);
