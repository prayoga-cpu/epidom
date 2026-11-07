/**
 * GET/PUT /api/stores/[id]/customer-display
 *
 * The customer-facing screen's look and promo banners (CustomerDisplaySettings)
 * plus the branding it reuses from the storefront and the receipt settings.
 *
 * GET always resolves a full config — the defaults for a store that never
 * saved one. The display window polls it, so a banner edited in the Store
 * Dashboard reaches a screen that has been open all day.
 *
 * PUT replaces the whole config and is the real owner's alone: these are
 * promotions shown to every customer, and a cashier or manager persona on the
 * owner's device must not be able to change them.
 */
import { NextResponse } from "next/server";
import { getCustomerDisplayConfig, updateCustomerDisplaySettings } from "@/lib/services";
import { customerDisplaySettingsSchema } from "@/lib/validation/customer-display.schemas";
import { requireOwnerOnlyApi } from "@/lib/auth/require-owner-only";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const config = await getCustomerDisplayConfig(storeId!);
    return NextResponse.json(createSuccessResponse(config));
  },
  { rateLimitEndpoint: "/api/stores/[id]/customer-display", requireStoreAuth: true }
);

export const PUT = withApiHandler(
  async (request, { storeId, userId }) => {
    const denied = await requireOwnerOnlyApi(storeId!);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = customerDisplaySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid customer display settings",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const config = await updateCustomerDisplaySettings(storeId!, parsed.data, { userId });
    return NextResponse.json(createSuccessResponse(config));
  },
  { rateLimitEndpoint: "/api/stores/[id]/customer-display", requireStoreAuth: true }
);
