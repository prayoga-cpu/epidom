/**
 * GET/PATCH /api/stores/[id]/receipt-settings
 *
 * A store's receipt branding (address/contact reused from Store + Storefront,
 * merged with the receipt-only overrides in StoreReceiptSettings) and the
 * WhatsApp auto-send toggle. GET always resolves a full object — never a
 * bare null — same convention as /finance/settings.
 */
import { NextResponse } from "next/server";
import { getReceiptBranding, updateReceiptSettings } from "@/lib/services";
import { updateReceiptSettingsSchema } from "@/lib/validation/receipt-settings.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const settings = await getReceiptBranding(storeId!);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/receipt-settings", requireStoreAuth: true }
);

export const PATCH = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = updateReceiptSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const settings = await updateReceiptSettings(storeId!, parsed.data);
    return NextResponse.json(createSuccessResponse(settings));
  },
  { rateLimitEndpoint: "/api/stores/[id]/receipt-settings", requireStoreAuth: true }
);
