import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { checkSlugAvailability } from "@/lib/services/onboarding.service";
import { slugCheckQuerySchema } from "@/lib/validation/onboarding.schemas";
import { createSuccessResponse } from "@/types/api/responses";

/**
 * GET /api/onboarding/slug-check?slug=mon-cafe
 *
 * Whether a store link is free, as the wizard's link field is typed. The
 * value is normalized first ("Mon Café" -> "mon-cafe"). Returns a
 * `SlugCheckResult`: invalid -> `available: false, suggestion: null`; taken ->
 * `available: false` with a free `suggestion`. The caller's own current link
 * counts as available.
 */
export const GET = withApiHandler(
  async (request, { userId }) => {
    const { searchParams } = new URL(request.url);
    const { slug } = slugCheckQuerySchema.parse({ slug: searchParams.get("slug") ?? undefined });
    const result = await checkSlugAvailability(userId, slug);
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/onboarding/slug-check" }
);
