import { NextResponse } from "next/server";
import { storefrontService, GoogleReviewLinkError } from "@/lib/services/storefront.service";
import { updateGoogleReviewSchema } from "@/lib/validation/storefront.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * PATCH /api/stores/[id]/storefront/google-review
 *
 * Connect (`link`), pause/resume (`enabled`) or disconnect (`link: ""`) the
 * store's Google review link. A separate route from PATCH /storefront on
 * purpose — see updateGoogleReviewSchema.
 *
 * A link that isn't a Google review link or Place ID is a 400 carrying
 * `details.reason` ("invalid" | "mapsListing") for the client to translate.
 */
export const PATCH = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const input = updateGoogleReviewSchema.parse(body);

    try {
      const updated = await storefrontService.updateGoogleReview(storeId!, input);
      return NextResponse.json(createSuccessResponse(updated));
    } catch (error) {
      if (error instanceof GoogleReviewLinkError) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, error.message, { reason: error.reason }),
          { status: 400 }
        );
      }
      throw error;
    }
  },
  {
    requireStoreAuth: true,
  }
);
